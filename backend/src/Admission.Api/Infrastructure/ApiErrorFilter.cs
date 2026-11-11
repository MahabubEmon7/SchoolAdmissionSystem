using Admission.Api.Contracts;

namespace Admission.Api.Infrastructure;

/// <summary>
/// Converts expected business errors into JSON responses inside the endpoint, so they are
/// not logged as server failures. Unexpected errors still reach <see cref="ApiExceptionHandler"/>.
/// </summary>
public sealed class ApiErrorFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        try
        {
            return await next(context);
        }
        catch (ApiException error)
        {
            return Results.Json(new ErrorResponse(error.Code, error.Message), statusCode: error.StatusCode);
        }
    }
}
