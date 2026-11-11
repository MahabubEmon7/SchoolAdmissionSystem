using Admission.Api.Contracts;
using Admission.Api.Infrastructure;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public static class HoldEndpoints
{
    public static void MapHoldEndpoints(this IEndpointRouteBuilder app)
    {
        var holds = app.MapGroup("/holds").WithTags("Holds");

        holds.MapGet("/{holdId:guid}", async (Guid holdId, AdmissionService service, CancellationToken ct) =>
                Results.Ok(await service.GetHoldAsync(holdId, ct)))
            .Produces<HoldResponse>()
            .Produces<ErrorResponse>(StatusCodes.Status404NotFound);

        holds.MapPost("/{holdId:guid}/confirm", async (Guid holdId, ConfirmHoldRequest? request, HttpRequest http,
                AdmissionService service, CancellationToken ct) =>
                Results.Ok(await service.ConfirmAsync(holdId, StudentHeader.Require(http), request, ct)))
            .Produces<HoldConfirmedResponse>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict);

        holds.MapPatch("/{holdId:guid}/info", async (Guid holdId, UpdateStudentInfoRequest request, HttpRequest http,
                AdmissionService service, CancellationToken ct) =>
                Results.Ok(await service.UpdateStudentInfoAsync(holdId, StudentHeader.Require(http), request, ct)))
            .Produces<HoldResponse>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status403Forbidden);

        holds.MapDelete("/{holdId:guid}", async (Guid holdId, HttpRequest http,
                AdmissionService service, CancellationToken ct) =>
            {
                await service.CancelAsync(holdId, StudentHeader.Require(http), ct);
                return Results.NoContent();
            })
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
            .Produces<ErrorResponse>(StatusCodes.Status409Conflict);

        app.MapGet("/me/holds", async (HttpRequest http, AdmissionService service, CancellationToken ct) =>
                Results.Ok(await service.GetStudentHoldsAsync(StudentHeader.Require(http), ct)))
            .WithTags("Holds")
            .Produces<IReadOnlyList<StudentHoldResponse>>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);
    }
}
