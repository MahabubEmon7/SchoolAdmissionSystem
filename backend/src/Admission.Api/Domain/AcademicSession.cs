namespace Admission.Api.Domain;

public enum SessionStatus
{
    Upcoming,
    Active,
    Archived,
}

public sealed class AcademicSession
{
    public const int MinYear = 2020;
    public const int MaxYear = 2100;

    public int AcademicYear { get; init; }
    public required string Title { get; set; }
    public SessionStatus Status { get; set; }

    /// <summary>Exact future wall-clock date & time when admissions open (required for Upcoming).</summary>
    public DateTimeOffset? StartsAt { get; set; }

    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ArchivedAt { get; set; }
    public string? Notes { get; set; }

    public List<SchoolClass> Classes { get; init; } = [];
    public List<Hold> Holds { get; init; } = [];

    public bool IsCurrentlyActive(DateTimeOffset now) =>
        Status == SessionStatus.Active || (Status == SessionStatus.Upcoming && StartsAt.HasValue && StartsAt.Value <= now);
}

public static class SessionStatusExtensions
{
    public static string ToCode(this SessionStatus status) => status.ToString().ToUpperInvariant();

    public static SessionStatus ParseSessionStatus(string? status) =>
        status?.Trim().ToUpperInvariant() switch
        {
            "ACTIVE" => SessionStatus.Active,
            "UPCOMING" => SessionStatus.Upcoming,
            "ARCHIVED" => SessionStatus.Archived,
            _ => throw new ArgumentException($"Invalid session status: '{status}'. Must be ACTIVE, UPCOMING, or ARCHIVED.", nameof(status)),
        };
}

