using Admission.Api.Contracts;
using Admission.Api.Infrastructure;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public static class ClassEndpoints
{
    public static void MapClassEndpoints(this IEndpointRouteBuilder app)
    {
        var classes = app.MapGroup("/classes").WithTags("Classes");

        classes.MapPost("", async (CreateClassRequest request, ClassService service, CancellationToken ct) =>
            {
                var created = await service.CreateClassAsync(request, ct);
                return Results.Created($"/classes/{created.Id}", created);
            })
            .Produces<ClassCreatedResponse>(StatusCodes.Status201Created)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict);

        classes.MapGet("", async (
                int? grade,
                string? shift,
                bool? availableOnly,
                string? search,
                int? year,
                ClassService service,
                CancellationToken ct) =>
                Results.Ok(await service.GetClassesAsync(grade, shift, availableOnly, search, year, ct)))
            .Produces<IReadOnlyList<ClassResponse>>();

        classes.MapGet("/{classId:guid}", async (Guid classId, ClassService service, CancellationToken ct) =>
                Results.Ok(await service.GetClassAsync(classId, ct)))
            .Produces<ClassResponse>()
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound);

        classes.MapPatch("/{classId:guid}", async (Guid classId, UpdateClassSeatsRequest request,
                ClassService service, CancellationToken ct) =>
            {
                var updated = await service.UpdateClassSeatsAsync(classId, request.TotalSeats, ct);
                return Results.Ok(updated);
            })
            .Produces<ClassResponse>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound);

        classes.MapDelete("/{classId:guid}", async (Guid classId, ClassService service, CancellationToken ct) =>
            {
                await service.DeleteClassAsync(classId, ct);
                return Results.NoContent();
            })
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound);

        classes.MapPost("/{classId:guid}/holds", async (Guid classId, HttpRequest http,
                AdmissionService service, CancellationToken ct) =>
            {
                var hold = await service.CreateHoldAsync(classId, StudentHeader.Require(http), ct);
                return Results.Created($"/holds/{hold.HoldId}", hold);
            })
            .WithTags("Holds")
            .Produces<HoldCreatedResponse>(StatusCodes.Status201Created)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict);

        classes.MapPost("/{classId:guid}/waitlist", async (Guid classId, HttpRequest http,
                AdmissionService service, CancellationToken ct) =>
            {
                var entry = await service.JoinWaitlistAsync(classId, StudentHeader.Require(http), ct);
                return Results.Created($"/holds/{entry.HoldId}", entry);
            })
            .WithTags("Holds")
            .WithSummary("Join the waitlist (or get a seat straight away if one is free)")
            .Produces<HoldCreatedResponse>(StatusCodes.Status201Created)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict);
    }
}
