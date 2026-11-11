using Admission.Api.Domain;

namespace Admission.Api.Infrastructure;

public static class StudentHeader
{
    public const string Name = "X-Student-Id";

    /// <summary>Returns the caller's student ID or throws 400 INVALID_STUDENT_ID.</summary>
    public static string Require(HttpRequest request)
    {
        var value = request.Headers[Name].ToString().Trim();
        return StudentId.IsValid(value) ? value : throw Errors.InvalidStudentId();
    }
}
