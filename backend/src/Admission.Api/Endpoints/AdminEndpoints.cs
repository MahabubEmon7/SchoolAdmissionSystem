using Admission.Api.Contracts;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/admin").WithTags("Admin");

        admin.MapGet("/stats", async (int? year, AdminService service, CancellationToken ct) =>
            Results.Ok(await service.GetStatsAsync(year, ct)))
            .Produces<AdminStatsResponse>();

        admin.MapGet("/applications", async (int? year, Guid? classId, string? status, string? search,
            AdminService service, CancellationToken ct) =>
            Results.Ok(await service.GetApplicationsAsync(year, classId, status, search, ct)))
            .Produces<IReadOnlyList<AdminHoldDetail>>();

        admin.MapGet("/academic-years", async (AdminService service, CancellationToken ct) =>
            Results.Ok(await service.GetAcademicYearsAsync(ct)))
            .Produces<AcademicYearsResponse>();

        admin.MapPost("/academic-years/archive-past", async (int? cutoffYear, AdminService service, CancellationToken ct) =>
            Results.Ok(await service.ArchivePastYearsAsync(cutoffYear, ct)))
            .Produces<ArchivePastYearsResponse>();

        admin.MapPost("/seed", async (AdminService service, CancellationToken ct) =>
        {
            var result = await service.SeedDatabaseAsync(ct);
            return Results.Ok(result);
        })
        .Produces<SeedDatabaseResponse>();
    }
}
