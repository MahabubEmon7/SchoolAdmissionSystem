using Admission.Api.Contracts;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Admission.Api.Infrastructure;

/// <summary>Last-resort handler: unexpected exceptions become a clean JSON error response.</summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        logger.LogError(exception, "Unhandled error processing {Method} {Path}: {Message}",
            context.Request.Method, context.Request.Path, exception.Message);

        var (status, error) = exception switch
        {
            ApiException api => (api.StatusCode, new ErrorResponse(api.Code, api.Message)),
            BadHttpRequestException bad => (bad.StatusCode, ForStatus(bad.StatusCode)),
            DbUpdateException dbEx when dbEx.InnerException is PostgresException pg && pg.SqlState == "23514" =>
                (StatusCodes.Status400BadRequest, new ErrorResponse("CHECK_VIOLATION", "Unable to complete request due to data constraints. Please try again.")),
            _ => (StatusCodes.Status500InternalServerError,
                new ErrorResponse("SERVER_ERROR", "Something went wrong on the server. Please try again.")),
        };

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(error, ct);
        return true;
    }

    /// <summary>Body for framework responses that have none (bad JSON, unknown route, ...).</summary>
    public static ErrorResponse ForStatus(int status) => status switch
    {
        StatusCodes.Status400BadRequest => new("INVALID_REQUEST", "The request body is missing or is not valid JSON."),
        StatusCodes.Status404NotFound => new("NOT_FOUND", "The requested resource was not found."),
        StatusCodes.Status405MethodNotAllowed => new("METHOD_NOT_ALLOWED", "This method is not supported here."),
        StatusCodes.Status415UnsupportedMediaType => new("UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON."),
        _ => new("REQUEST_FAILED", "The request could not be completed."),
    };
}
