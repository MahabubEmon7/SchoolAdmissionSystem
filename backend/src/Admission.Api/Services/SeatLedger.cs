using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Admission.Api.Services;

public readonly record struct Occupancy(int Held, int Confirmed)
{
    public int Taken => Held + Confirmed;
}

/// <summary>
/// Locking, seat counting and waitlist promotion shared by the API and the expiry worker.
/// Call these inside a transaction. Lock order is always student → class → hold rows.
/// </summary>
public sealed class SeatLedger(AdmissionDbContext db, AdmissionOptions options)
{
    /// <summary>Serialises applications from one student, so "one active application" can't race.</summary>
    public Task LockStudentAsync(string studentId, CancellationToken ct) =>
        db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(1, hashtext({studentId}))", ct);

    /// <summary>Row-locks a class until the transaction ends; every seat change for it waits here.</summary>
    public async Task<SchoolClass?> LockClassAsync(Guid classId, CancellationToken ct) =>
        (await db.Classes
            .FromSql($"SELECT * FROM classes WHERE id = {classId} FOR UPDATE")
            .AsNoTracking()
            .ToListAsync(ct)).SingleOrDefault();

    public async Task<Occupancy> CountOccupancyAsync(Guid classId, DateTimeOffset now, CancellationToken ct) =>
        await db.Classes
            .Where(c => c.Id == classId)
            .Select(c => new Occupancy(
                c.Holds.Count(h => h.Status == HoldStatus.Held && h.ExpiresAt > now),
                c.Holds.Count(h => h.Status == HoldStatus.Confirmed)))
            .SingleAsync(ct);

    /// <summary>
    /// Gives every free seat to the longest-waiting students, starting their payment timers.
    /// The class must already be locked. Returns how many students were promoted.
    /// </summary>
    public async Task<int> PromoteWaitlistAsync(SchoolClass schoolClass, DateTimeOffset now, CancellationToken ct)
    {
        var free = schoolClass.TotalSeats - (await CountOccupancyAsync(schoolClass.Id, now, ct)).Taken;
        if (free <= 0) return 0;

        var next = await db.Holds
            .FromSql($"""
                SELECT * FROM holds
                WHERE class_id = {schoolClass.Id} AND status = 'WAITLISTED'
                ORDER BY queue_number
                LIMIT {free}
                FOR UPDATE
                """)
            .ToListAsync(ct);
        foreach (var hold in next) hold.PromoteToHeld(now, options.HoldDurationSeconds);
        if (next.Count > 0) await db.SaveChangesAsync(ct);
        return next.Count;
    }

    /// <summary>1 for the next student in line.</summary>
    public async Task<int> WaitlistPositionAsync(Hold hold, CancellationToken ct) =>
        await db.Holds.CountAsync(h => h.ClassId == hold.ClassId
            && h.Status == HoldStatus.Waitlisted && h.QueueNumber < hold.QueueNumber, ct) + 1;
}
