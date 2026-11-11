namespace Admission.Api.Infrastructure;

/// <summary>An expected failure with a stable machine-readable code for the frontend.</summary>
public class ApiException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
}

public static class Errors
{
    public static ApiException Validation(string message) => new(400, "VALIDATION_ERROR", message);

    public static ApiException InvalidStudentId() => new(400, "INVALID_STUDENT_ID",
        "Enter a valid 17-digit Birth Registration Number.");

    public static ApiException InvalidStudentInfo(string message) => new(400, "INVALID_STUDENT_INFO", message);

    public static ApiException ClassNotFound() => new(404, "CLASS_NOT_FOUND", "Class not found.");
    public static ApiException HoldNotFound() => new(404, "HOLD_NOT_FOUND", "Application not found.");

    public static ApiException NotOwner() => new(403, "FORBIDDEN",
        "This application belongs to a different student.");

    public static ApiException SeatsFull(bool waitlistOpen) => new(409, "SEATS_FULL", waitlistOpen
        ? "No seats are free right now. Join the waitlist to get the next seat that opens."
        : "Seats are full for this class.");

    public static ApiException AlreadyApplied(string className) => new(409, "ALREADY_APPLIED",
        $"You already have an active application for {className}. A student can apply to only one class at a time.");

    public static ApiException ClassExists(string className) => new(409, "CLASS_EXISTS",
        $"{className} already exists.");

    public static ApiException ClassFull() => new(409, "CLASS_FULL",
        "All seats in this class are confirmed, so there is no waitlist.");

    public static ApiException OnWaitlist() => new(409, "HOLD_WAITLISTED",
        "You're on the waitlist. You can pay once a seat is held for you.");

    public static ApiException HoldExpired() => new(409, "HOLD_EXPIRED", "This seat hold has expired.");
    public static ApiException HoldCancelled() => new(409, "HOLD_CANCELLED", "This application was cancelled.");

    public static ApiException AlreadyConfirmed() => new(409, "HOLD_CONFIRMED",
        "This admission is already confirmed and cannot be cancelled.");
}
