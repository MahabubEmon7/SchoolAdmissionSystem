using System.Text.RegularExpressions;

namespace Admission.Api.Domain;

public enum ClassShift
{
    Morning,
    Day,
}

public sealed partial class SchoolClass
{
    public const int MinGrade = 1;
    public const int MaxGrade = 12;
    public const int MaxSeats = 100_000;
    public const int MinAcademicYear = 2020;
    public const int MaxAcademicYear = 2100;
    public const int DefaultAcademicYear = 2026;

    public Guid Id { get; init; }
    public int AcademicYear { get; init; } = DefaultAcademicYear;
    public int Grade { get; init; }
    public ClassShift Shift { get; init; }
    public required string Name { get; set; }
    public int TotalSeats { get; set; }
    public DateTimeOffset CreatedAt { get; init; }

    public List<Hold> Holds { get; init; } = [];

    public static bool IsValidGrade(int grade) => grade is >= MinGrade and <= MaxGrade;
    public static bool IsValidAcademicYear(int year) => year is >= MinAcademicYear and <= MaxAcademicYear;

    /// <summary>"Class 6 - Morning Shift" or "Class 6 - Day Shift".</summary>
    public static string DisplayName(int grade, ClassShift shift) =>
        $"Class {grade} - {shift} Shift";

    /// <summary>
    /// Reads a grade and shift from names like "class 6 - morning shift" or "Class 6 Day".
    /// Class shift (Morning or Day) is strictly required; general/no-shift is not permitted.
    /// </summary>
    public static bool TryParseName(string? name, out int grade, out ClassShift shift)
    {
        grade = 0;
        shift = default;
        var match = NamePattern().Match(name ?? "");
        if (!match.Success || !int.TryParse(match.Groups["grade"].Value, out grade)) return false;
        if (!match.Groups["shift"].Success) return false;
        shift = Enum.Parse<ClassShift>(match.Groups["shift"].Value, ignoreCase: true);
        return IsValidGrade(grade);
    }

    [GeneratedRegex(@"^\s*class\s*(?<grade>\d{1,2})\s*[-–—:]?\s*(?<shift>morning|day)(?:\s*shift)?\s*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex NamePattern();
}
