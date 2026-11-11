namespace Admission.Api.Contracts;

// Field names are part of the public API contract. Add fields freely; never rename or remove.

/// <summary>
/// Send <c>grade</c> (1–12) and <c>shift</c> ("MORNING" or "DAY"). For the original
/// contract, <c>name</c> alone also works when it reads like "Class 6 - Morning Shift".
/// Shift is mandatory; general/no-shift is not permitted.
/// Academic year defaults to current admission year (2026).
/// </summary>
public sealed record CreateClassRequest(
    string? Name,
    int? TotalSeats,
    int? Grade = null,
    string? Shift = null,
    int? AcademicYear = null);

public sealed record UpdateClassSeatsRequest(int TotalSeats);

public sealed record ClassCreatedResponse(
    Guid Id,
    string Name,
    int TotalSeats,
    int Grade,
    string Shift,
    int AcademicYear = 2026);

public sealed record ClassResponse(
    Guid Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats,
    int Grade,
    string Shift,
    int WaitlistCount,
    int AcademicYear = 2026);

public sealed record HoldCreatedResponse(
    Guid HoldId,
    Guid ClassId,
    string StudentId,
    string Status,
    DateTime? ExpiresAt,
    int? WaitlistPosition = null,
    int AcademicYear = 2026);

public sealed record HoldResponse(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    string Status,
    DateTime? ExpiresAt,
    string? StudentName = null,
    int? Age = null,
    int AcademicYear = 2026);

public sealed record ConfirmHoldRequest(
    string? StudentName = null,
    int? Age = null);

public sealed record UpdateStudentInfoRequest(
    string StudentName,
    int Age);

public sealed record HoldConfirmedResponse(
    Guid HoldId,
    string Status,
    string? StudentName = null,
    int? Age = null,
    int AcademicYear = 2026);

public sealed record StudentHoldResponse(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    string Status,
    DateTime? ExpiresAt,
    DateTime CreatedAt,
    int? WaitlistPosition,
    string? StudentName = null,
    int? Age = null,
    int AcademicYear = 2026);

public sealed record ErrorResponse(string Error, string Message);

public sealed record AdminShiftStat(
    string Shift,
    string Label,
    int TotalSeats,
    int Confirmed,
    int Held,
    int Available,
    int Waitlist);

public sealed record AdminClassStat(
    Guid Id,
    string Name,
    int Grade,
    string Shift,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats,
    int WaitlistCount,
    double OccupancyRate,
    int AcademicYear = 2026);

public sealed record AdminStatsResponse(
    int TotalCapacity,
    int TotalHeld,
    int TotalConfirmed,
    int TotalAvailable,
    int TotalWaitlist,
    int TotalCancelled,
    int TotalExpired,
    double OccupancyRate,
    int ClassCount,
    IReadOnlyList<AdminShiftStat> ShiftStats,
    IReadOnlyList<AdminClassStat> Classes,
    int AcademicYear = 2026,
    bool IsArchived = false);

public sealed record AdminHoldDetail(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    int Grade,
    string Shift,
    string StudentId,
    string Status,
    DateTime? ExpiresAt,
    DateTime CreatedAt,
    DateTime? ConfirmedAt,
    DateTime? CancelledAt,
    long QueueNumber,
    int? WaitlistPosition,
    string? StudentName = null,
    int? Age = null,
    int AcademicYear = 2026);

public sealed record AcademicYearInfo(
    int Year,
    string Label,
    bool IsActive,
    int TotalClasses,
    int TotalConfirmed,
    int TotalCapacity);

public sealed record AcademicYearsResponse(
    int ActiveYear,
    IReadOnlyList<AcademicYearInfo> Years);

public sealed record ArchivePastYearsResponse(
    int PrunedCount,
    string Message);

public sealed record CreateSessionRequest(
    int AcademicYear,
    string? Title,
    string Status,
    DateTimeOffset? StartsAt = null,
    string? Notes = null);

public sealed record AcademicSessionDetail(
    int AcademicYear,
    string Title,
    string Status,
    DateTimeOffset? StartsAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ArchivedAt,
    int ClassCount,
    int TotalCapacity,
    int ConfirmedCount,
    int HeldCount,
    int WaitlistCount,
    string? Notes);

public sealed record ActiveSessionResponse(
    AcademicSessionDetail? ActiveSession,
    AcademicSessionDetail? NextUpcomingSession);

public sealed record ArchiveSessionResponse(
    int AcademicYear,
    string Title,
    int PrunedCount,
    int AdmittedRetainedCount,
    string Message);

public sealed record SeedDatabaseResponse(
    int TotalSessions,
    int TotalClasses,
    int TotalStudents,
    int ConfirmedStudents,
    int HeldStudents,
    int WaitlistedStudents,
    string Message);
