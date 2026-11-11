namespace Admission.Api.Domain;

public enum HoldStatus
{
    /// <summary>In line for a seat; becomes HELD automatically when one frees up.</summary>
    Waitlisted,
    Held,
    Confirmed,
    Expired,
    Cancelled,
}

/// <summary>
/// A student's application to a class. A student has at most one active application
/// (WAITLISTED, HELD or CONFIRMED) across all classes.
/// </summary>
public sealed class Hold
{
    public static readonly HoldStatus[] ActiveStatuses = [HoldStatus.Waitlisted, HoldStatus.Held, HoldStatus.Confirmed];

    public Guid Id { get; init; }

    /// <summary>Academic year for this admission cycle (e.g. 2026).</summary>
    public int AcademicYear { get; init; } = SchoolClass.DefaultAcademicYear;

    /// <summary>Database-assigned, ever-increasing number: the fair "first come, first served" order.</summary>
    public long QueueNumber { get; init; }

    public Guid ClassId { get; init; }
    public SchoolClass? Class { get; init; }
    public required string StudentId { get; init; }

    /// <summary>Student full name, provided and validated prior to completing payment.</summary>
    public string? StudentName { get; set; }

    /// <summary>Student age (in years), provided and validated prior to completing payment.</summary>
    public int? Age { get; set; }

    public HoldStatus Status { get; set; }

    /// <summary>Payment deadline. Null while waitlisted; set when a seat is held.</summary>
    public DateTimeOffset? ExpiresAt { get; set; }

    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ConfirmedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }

    /// <summary>
    /// The status a client should see. A HELD row past its deadline is already
    /// EXPIRED even if the background sweep has not rewritten it yet.
    /// </summary>
    public HoldStatus EffectiveStatus(DateTimeOffset now) =>
        Status == HoldStatus.Held && ExpiresAt <= now ? HoldStatus.Expired : Status;

    /// <summary>Gives a waitlisted student a seat and starts their payment timer.</summary>
    public void PromoteToHeld(DateTimeOffset now, int holdSeconds)
    {
        Status = HoldStatus.Held;
        ExpiresAt = now.AddSeconds(holdSeconds);
    }
}

public static class HoldStatusExtensions
{
    /// <summary>API and database representation: WAITLISTED, HELD, CONFIRMED, EXPIRED, CANCELLED.</summary>
    public static string ToCode(this HoldStatus status) => status.ToString().ToUpperInvariant();

    public static string ToCode(this ClassShift shift) => shift.ToString().ToUpperInvariant();
}
