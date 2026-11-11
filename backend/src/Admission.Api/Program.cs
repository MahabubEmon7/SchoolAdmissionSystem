using System.Threading.RateLimiting;
using Admission.Api.Contracts;
using Admission.Api.Data;
using Admission.Api.Endpoints;
using Admission.Api.Infrastructure;
using Admission.Api.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Options are resolved lazily so test hosts can override configuration.
builder.Services.AddSingleton(sp => AdmissionOptions.FromConfiguration(sp.GetRequiredService<IConfiguration>()));
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddDbContext<AdmissionDbContext>((sp, db) => db
    .UseNpgsql(sp.GetRequiredService<AdmissionOptions>().DatabaseConnectionString)
    .UseSnakeCaseNamingConvention());

builder.Services.AddSingleton<ISeatCache>(sp =>
{
    var options = sp.GetRequiredService<AdmissionOptions>();
    return string.IsNullOrWhiteSpace(options.RedisConnectionString)
        ? new NoSeatCache()
        : ActivatorUtilities.CreateInstance<RedisSeatCache>(sp);
});
builder.Services.AddScoped<SeatLedger>();
builder.Services.AddScoped<ClassService>();
builder.Services.AddScoped<AdmissionService>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddScoped<SessionService>();
builder.Services.AddHostedService<HoldExpiryWorker>();

builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();
// Malformed bodies become a plain 400 that UseStatusCodePages fills in, in every environment.
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = false);
builder.Services.AddCors();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddRateLimiter(limiterOptions =>
{
    limiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    limiterOptions.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new ErrorResponse("RATE_LIMITED", "Too many requests. Please wait a moment and try again."),
            cancellationToken: token);
    };
    limiterOptions.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var studentId = httpContext.Request.Headers[StudentHeader.Name].ToString().Trim();
        var clientKey = !string.IsNullOrEmpty(studentId)
            ? $"student:{studentId}"
            : httpContext.Connection.RemoteIpAddress?.ToString() ?? "global";

        return RateLimitPartition.GetSlidingWindowLimiter(
            clientKey,
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0
            });
    });
});

var app = builder.Build();
var options = app.Services.GetRequiredService<AdmissionOptions>();

await DatabaseMigrator.MigrateAsync(app.Services);

app.UseExceptionHandler();
app.UseStatusCodePages(async status =>
{
    var response = status.HttpContext.Response;
    await response.WriteAsJsonAsync(ApiExceptionHandler.ForStatus(response.StatusCode));
});
app.UseRateLimiter();
app.UseCors(cors =>
{
    if (options.CorsOrigins.Contains("*")) cors.AllowAnyOrigin();
    else cors.WithOrigins(options.CorsOrigins);
    // Cache preflights so the X-Student-Id header doesn't add an OPTIONS round trip per request.
    cors.AllowAnyHeader().AllowAnyMethod().SetPreflightMaxAge(TimeSpan.FromHours(1));
});
app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/health", async (AdmissionDbContext db, CancellationToken ct) =>
        await db.Database.CanConnectAsync(ct)
            ? Results.Ok(new { status = "ok" })
            : Results.Json(new { status = "database unavailable" }, statusCode: 503))
    .ExcludeFromDescription();
var api = app.MapGroup("").AddEndpointFilter<ApiErrorFilter>();
api.MapClassEndpoints();
api.MapHoldEndpoints();
api.MapAdminEndpoints();
api.MapSessionEndpoints();

app.Run();

public partial class Program;
