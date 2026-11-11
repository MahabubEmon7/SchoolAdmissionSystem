namespace Admission.Api.Domain;

/// <summary>A 17-digit Birth Registration Number, kept as a string to preserve leading zeros.</summary>
public static class StudentId
{
    public const int Length = 17;

    public static bool IsValid(string? value) =>
        value is { Length: Length } && value.All(char.IsAsciiDigit);
}
