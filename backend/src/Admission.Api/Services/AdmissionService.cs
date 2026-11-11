using Admission.Api.Contracts;
using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Admission.Api.Services;

/// <summary>
/// Student applications: hold a seat, join a waitlist, pay (confirm), cancel.
/// Every change that affects a class's seats runs in a transaction holding that class's
/// row lock, so seat limits hold across any number of API processes (see <see cref="SeatLedger"/>).
/// </summary>
public sealed class AdmissionService(
    AdmissionDbContext db,
    SeatLedger ledger,
    AdmissionOptions options,
    TimeProvider clock,
    ISeatCache cache)
{
    public async Task<HoldCreatedResponse> CreateHoldAsync(Guid classId, string studentId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (schoolClass, now) = await BeginApplicationAsync(classId, studentId, ct);

        var occupancy = await ledger.CountOccupancyAsync(classId, now, ct);
        if (occupancy.Taken >= schoolClass.TotalSeats)
            await RejectAsync(tx, classId, Errors.SeatsFull(waitlistOpen: occupancy.Held > 0), ct);

        var hold = NewApplication(classId, studentId, now, schoolClass.AcademicYear);
        hold.PromoteToHeld(now, options.HoldDurationSeconds);
        await SaveNewApplicationAsync(hold, tx, ct);
        return new(hold.Id, classId, studentId, hold.Status.ToCode(), hold.ExpiresAt?.UtcDateTime, null, hold.AcademicYear);
    }

    /// <summary>
    /// Joins the class's waitlist. If a seat happens to be free, holds it straight away instead.
    /// </summary>
    public async Task<HoldCreatedResponse> JoinWaitlistAsync(Guid classId, string studentId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (schoolClass, now) = await BeginApplicationAsync(classId, studentId, ct);

        var occupancy = await ledger.CountOccupancyAsync(classId, now, ct);
        if (occupancy.Confirmed >= schoolClass.TotalSeats) await RejectAsync(tx, classId, Errors.ClassFull(), ct);

        var hold = NewApplication(classId, studentId, now, schoolClass.AcademicYear);
        if (occupancy.Taken < schoolClass.TotalSeats) hold.PromoteToHeld(now, options.HoldDurationSeconds);
        await SaveNewApplicationAsync(hold, tx, ct);

        int? position = hold.Status == HoldStatus.Waitlisted ? await ledger.WaitlistPositionAsync(hold, ct) : null;
        return new(hold.Id, classId, studentId, hold.Status.ToCode(), hold.ExpiresAt?.UtcDateTime, position, hold.AcademicYear);
    }

    public async Task<HoldResponse> GetHoldAsync(Guid holdId, CancellationToken ct)
    {
        var now = clock.UtcNowForDb();
        var hold = await db.Holds.AsNoTracking().Include(h => h.Class)
            .SingleOrDefaultAsync(h => h.Id == holdId, ct) ?? throw Errors.HoldNotFound();
        return new(hold.Id, hold.ClassId, hold.Class!.Name, hold.EffectiveStatus(now).ToCode(),
            hold.ExpiresAt?.UtcDateTime, hold.StudentName, hold.Age, hold.AcademicYear);
    }

    public async Task<IReadOnlyList<StudentHoldResponse>> GetStudentHoldsAsync(string studentId, CancellationToken ct)
    {
        var now = clock.UtcNowForDb();
        var holds = await db.Holds.AsNoTracking().Include(h => h.Class)
            .Where(h => h.StudentId == studentId)
            .OrderByDescending(h => h.QueueNumber)
            .ToListAsync(ct);

        var result = new List<StudentHoldResponse>(holds.Count);
        foreach (var h in holds)
        {
            int? position = h.Status == HoldStatus.Waitlisted ? await ledger.WaitlistPositionAsync(h, ct) : null;
            result.Add(new(h.Id, h.ClassId, h.Class!.Name, h.EffectiveStatus(now).ToCode(),
                h.ExpiresAt?.UtcDateTime, h.CreatedAt.UtcDateTime, position, h.StudentName, h.Age, h.AcademicYear));
        }
        return result;
    }

    /// <summary>Marks the admission fee as paid after verifying student basic info. Repeating it is safe and changes nothing.</summary>
    public async Task<HoldConfirmedResponse> ConfirmAsync(Guid holdId, string studentId, ConfirmHoldRequest? request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (hold, _, now) = await LockOwnedHoldAsync(holdId, studentId, ct);

        switch (hold.EffectiveStatus(now))
        {
            case HoldStatus.Confirmed:
                return new(hold.Id, HoldStatus.Confirmed.ToCode(), hold.StudentName, hold.Age, hold.AcademicYear);
            case HoldStatus.Held:
                var name = request?.StudentName?.Trim() ?? hold.StudentName;
                var age = request?.Age ?? hold.Age;

                if (string.IsNullOrWhiteSpace(name) || name.Length < 2 || name.Length > 100)
                    throw Errors.InvalidStudentInfo("Student full name is required and must be between 2 and 100 characters.");

                if (age is null or < 3 or > 25)
                    throw Errors.InvalidStudentInfo("Student age is required and must be between 3 and 25 years.");

                hold.StudentName = name;
                hold.Age = age;
                hold.Status = HoldStatus.Confirmed;
                hold.ConfirmedAt = now;
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                await cache.InvalidateAsync([hold.ClassId]);
                return new(hold.Id, HoldStatus.Confirmed.ToCode(), hold.StudentName, hold.Age, hold.AcademicYear);
            case HoldStatus.Waitlisted:
                throw Errors.OnWaitlist();
            case HoldStatus.Expired:
                throw Errors.HoldExpired();
            default:
                throw Errors.HoldCancelled();
        }
    }

    /// <summary>Saves or updates basic student info (name & age) while a seat hold is active.</summary>
    public async Task<HoldResponse> UpdateStudentInfoAsync(Guid holdId, string studentId, UpdateStudentInfoRequest request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (hold, schoolClass, now) = await LockOwnedHoldAsync(holdId, studentId, ct);

        if (hold.EffectiveStatus(now) != HoldStatus.Held)
            throw Errors.Validation("Student information can only be updated while holding a seat.");

        var name = request.StudentName?.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length < 2 || name.Length > 100)
            throw Errors.InvalidStudentInfo("Student full name is required and must be between 2 and 100 characters.");

        if (request.Age is < 3 or > 25)
            throw Errors.InvalidStudentInfo("Student age must be between 3 and 25 years.");

        hold.StudentName = name;
        hold.Age = request.Age;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new(hold.Id, hold.ClassId, schoolClass.Name, hold.EffectiveStatus(now).ToCode(),
            hold.ExpiresAt?.UtcDateTime, hold.StudentName, hold.Age, hold.AcademicYear);
    }

    /// <summary>
    /// Releases a held seat (handing it to the next waitlisted student) or leaves the waitlist.
    /// Cancelling an already-cancelled application succeeds again.
    /// </summary>
    public async Task CancelAsync(Guid holdId, string studentId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (hold, schoolClass, now) = await LockOwnedHoldAsync(holdId, studentId, ct);

        switch (hold.EffectiveStatus(now))
        {
            case HoldStatus.Cancelled:
                return;
            case HoldStatus.Held or HoldStatus.Waitlisted:
                hold.Status = HoldStatus.Cancelled;
                hold.CancelledAt = now;
                await db.SaveChangesAsync(ct);
                await ledger.PromoteWaitlistAsync(schoolClass, now, ct);
                await tx.CommitAsync(ct);
                await cache.InvalidateAsync([hold.ClassId]);
                return;
            case HoldStatus.Confirmed:
                throw Errors.AlreadyConfirmed();
            default:
                throw Errors.HoldExpired();
        }
    }

    /// <summary>
    /// Shared start of "apply" and "join waitlist": takes the student and class locks, enforces
    /// one active application per student, and gives any free seats to the waitlist first so a
    /// newcomer can't jump the queue.
    /// </summary>
    private async Task<(SchoolClass Class, DateTimeOffset Now)> BeginApplicationAsync(
        Guid classId, string studentId, CancellationToken ct)
    {
        await ledger.LockStudentAsync(studentId, ct);
        var schoolClass = await ledger.LockClassAsync(classId, ct) ?? throw Errors.ClassNotFound();
        var now = clock.UtcNowForDb(); // read after locking so time order matches lock order

        // Check session lifecycle: must be active / open
        var session = await db.Sessions.AsNoTracking().SingleOrDefaultAsync(s => s.AcademicYear == schoolClass.AcademicYear, ct);
        if (session is not null)
        {
            if (session.Status == SessionStatus.Archived)
                throw Errors.Validation($"Admissions for {session.Title} are closed and archived. This session is no longer accepting applicants.");
            if (session.Status == SessionStatus.Upcoming && session.StartsAt.HasValue && session.StartsAt.Value > now)
                throw Errors.Validation($"Admissions for {session.Title} have not started yet. Opens on {session.StartsAt.Value:f}.");
        }

        // An overdue HELD row still occupies the student's "active" slot; release it.
        await db.Holds
            .Where(h => h.StudentId == studentId && h.Status == HoldStatus.Held && h.ExpiresAt <= now)
            .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.Expired), ct);

        var activeIn = await db.Holds
            .Where(h => h.StudentId == studentId && h.AcademicYear == schoolClass.AcademicYear && Hold.ActiveStatuses.Contains(h.Status))
            .Select(h => h.Class!.Name)
            .FirstOrDefaultAsync(ct);
        if (activeIn is not null) throw Errors.AlreadyApplied(activeIn);

        await ledger.PromoteWaitlistAsync(schoolClass, now, ct);
        return (schoolClass, now);
    }

    /// <summary>
    /// Refuses the request but keeps what the transaction already did (expiring stale holds,
    /// promoting the waitlist): those changes are correct regardless of this request's outcome.
    /// </summary>
    private async Task RejectAsync(Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction tx, Guid classId,
        ApiException error, CancellationToken ct)
    {
        await tx.CommitAsync(ct);
        await cache.InvalidateAsync([classId]);
        throw error;
    }

    private static Hold NewApplication(Guid classId, string studentId, DateTimeOffset now, int academicYear) => new()
    {
        Id = Guid.NewGuid(),
        ClassId = classId,
        StudentId = studentId,
        AcademicYear = academicYear,
        Status = HoldStatus.Waitlisted,
        CreatedAt = now,
    };

    private async Task SaveNewApplicationAsync(Hold hold, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction tx,
        CancellationToken ct)
    {
        db.Holds.Add(hold);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw Errors.AlreadyApplied("another class"); // backstop; the student lock normally prevents this
        }

        await tx.CommitAsync(ct);
        await cache.InvalidateAsync([hold.ClassId]);
    }

    /// <summary>Locks the hold's class, then the hold (the same order every writer uses).</summary>
    private async Task<(Hold Hold, SchoolClass Class, DateTimeOffset Now)> LockOwnedHoldAsync(
        Guid holdId, string studentId, CancellationToken ct)
    {
        var owner = await db.Holds.AsNoTracking()
            .Where(h => h.Id == holdId)
            .Select(h => new { h.ClassId, h.StudentId })
            .SingleOrDefaultAsync(ct) ?? throw Errors.HoldNotFound();
        if (owner.StudentId != studentId) throw Errors.NotOwner();

        var schoolClass = (await ledger.LockClassAsync(owner.ClassId, ct))!; // classes are never deleted
        var hold = (await db.Holds
            .FromSql($"SELECT * FROM holds WHERE id = {holdId} FOR UPDATE")
            .ToListAsync(ct)).Single();
        return (hold, schoolClass, clock.UtcNowForDb());
    }
}
