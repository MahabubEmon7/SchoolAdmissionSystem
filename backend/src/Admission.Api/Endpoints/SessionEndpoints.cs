using Admission.Api.Contracts;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public static class SessionEndpoints
{
    public static void MapSessionEndpoints(this IEndpointRouteBuilder app)
    {
        // Public endpoint to check active admission cycle & upcoming announcement
        app.MapGet("/sessions/active", async (SessionService service, CancellationToken ct) =>
            Results.Ok(await service.GetActiveSessionAsync(ct)))
            .WithTags("Sessions")
            .Produces<ActiveSessionResponse>();

        var admin = app.MapGroup("/admin/sessions").WithTags("Admin Sessions");

        admin.MapGet("", async (SessionService service, CancellationToken ct) =>
            Results.Ok(await service.GetSessionsAsync(ct)))
            .Produces<IReadOnlyList<AcademicSessionDetail>>();

        admin.MapPost("", async (CreateSessionRequest request, SessionService service, CancellationToken ct) =>
            {
                var created = await service.CreateSessionAsync(request, ct);
                return Results.Created($"/admin/sessions/{created.AcademicYear}", created);
            })
            .Produces<AcademicSessionDetail>(StatusCodes.Status201Created)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        admin.MapPost("/{year:int}/archive", async (int year, SessionService service, CancellationToken ct) =>
            Results.Ok(await service.ArchiveSessionAsync(year, ct)))
            .Produces<ArchiveSessionResponse>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        admin.MapPost("/{year:int}/activate", async (int year, SessionService service, CancellationToken ct) =>
            Results.Ok(await service.ActivateSessionAsync(year, ct)))
            .Produces<AcademicSessionDetail>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);
    }
}

