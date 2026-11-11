using Admission.Api.Contracts;
using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Admission.Api.Services;

public sealed class SessionService(AdmissionDbContext db, TimeProvider clock, ISeatCache cache)
{
    public async Task<ActiveSessionResponse> GetActiveSessionAsync(CancellationToken ct)
    {
        var now = clock.UtcNowForDb();

        // Check if an upcoming session has reached its start date/time: auto-promote to Active
        var dueUpcoming = await db.Sessions
            .Where(s => s.Status == SessionStatus.Upcoming && s.StartsAt.HasValue && s.StartsAt.Value <= now)
            .OrderBy(s => s.StartsAt)
            .FirstOrDefaultAsync(ct);

        if (dueUpcoming is not null)
        {
            var oldActives = await db.Sessions
                .Where(s => s.Status == SessionStatus.Active && s.AcademicYear != dueUpcoming.AcademicYear)
                .ToListAsync(ct);

            foreach (var old in oldActives)
            {
                old.Status = SessionStatus.Archived;
                old.ArchivedAt = now;
                // Prune non-confirmed holds for the old active session
                await db.Holds
                    .Where(h => h.AcademicYear == old.AcademicYear && h.Status != HoldStatus.Confirmed)
                    .ExecuteDeleteAsync(ct);
            }

            dueUpcoming.Status = SessionStatus.Active;
            dueUpcoming.StartsAt = null;
            await db.SaveChangesAsync(ct);
            await cache.InvalidateAsync([]);
        }

        var activeSession = await db.Sessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Status == SessionStatus.Active, ct);

        var nextUpcoming = await db.Sessions
            .AsNoTracking()
            .Where(s => s.Status == SessionStatus.Upcoming && s.StartsAt.HasValue && s.StartsAt.Value > now)
            .OrderBy(s => s.StartsAt)
            .FirstOrDefaultAsync(ct);

        AcademicSessionDetail? activeDetail = null;
        if (activeSession is not null)
        {
            activeDetail = await MapSessionDetailAsync(activeSession, now, ct);
        }

        AcademicSessionDetail? upcomingDetail = null;
        if (nextUpcoming is not null)
        {
            upcomingDetail = await MapSessionDetailAsync(nextUpcoming, now, ct);
        }

        return new ActiveSessionResponse(activeDetail, upcomingDetail);
    }

    public async Task<IReadOnlyList<AcademicSessionDetail>> GetSessionsAsync(CancellationToken ct)
    {
        var now = clock.UtcNowForDb();
        var sessions = await db.Sessions
            .AsNoTracking()
            .OrderByDescending(s => s.Status == SessionStatus.Active ? 2 : s.Status == SessionStatus.Upcoming ? 1 : 0)
            .ThenByDescending(s => s.AcademicYear)
            .ToListAsync(ct);

        var list = new List<AcademicSessionDetail>(sessions.Count);
        foreach (var s in sessions)
        {
            list.Add(await MapSessionDetailAsync(s, now, ct));
        }

        return list;
    }

    public async Task<AcademicSessionDetail> CreateSessionAsync(CreateSessionRequest request, CancellationToken ct)
    {
        var now = clock.UtcNowForDb();

        if (request.AcademicYear is < AcademicSession.MinYear or > AcademicSession.MaxYear)
            throw Errors.Validation($"Academic year must be between {AcademicSession.MinYear} and {AcademicSession.MaxYear}.");

        if (await db.Sessions.AnyAsync(s => s.AcademicYear == request.AcademicYear, ct))
            throw Errors.Validation($"An academic session for year {request.AcademicYear} already exists.");

        var title = string.IsNullOrWhiteSpace(request.Title)
            ? $"Academic Session {request.AcademicYear}–{request.AcademicYear + 1}"
            : request.Title.Trim();

        var status = SessionStatusExtensions.ParseSessionStatus(request.Status);

        if (status == SessionStatus.Upcoming)
        {
            if (!request.StartsAt.HasValue)
                throw Errors.Validation("Start date and time is required for an Upcoming admission session.");

            if (request.StartsAt.Value <= now)
                throw Errors.Validation("Upcoming session start date and time must be set in the future.");
        }

        if (status == SessionStatus.Active)
        {
            // Transition any currently active session to Archived and prune unconfirmed holds
            var currentActives = await db.Sessions
                .Where(s => s.Status == SessionStatus.Active)
                .ToListAsync(ct);

            foreach (var ca in currentActives)
            {
                ca.Status = SessionStatus.Archived;
                ca.ArchivedAt = now;
                await db.Holds
                    .Where(h => h.AcademicYear == ca.AcademicYear && h.Status != HoldStatus.Confirmed)
                    .ExecuteDeleteAsync(ct);
            }
        }

        var session = new AcademicSession
        {
            AcademicYear = request.AcademicYear,
            Title = title,
            Status = status,
            StartsAt = status == SessionStatus.Upcoming ? request.StartsAt : null,
            CreatedAt = now,
            ArchivedAt = status == SessionStatus.Archived ? now : null,
            Notes = request.Notes?.Trim(),
        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync(ct);
        await cache.InvalidateAsync([]);

        return await MapSessionDetailAsync(session, now, ct);
    }

    public async Task<ArchiveSessionResponse> ArchiveSessionAsync(int year, CancellationToken ct)
    {
        var now = clock.UtcNowForDb();
        var session = await db.Sessions.SingleOrDefaultAsync(s => s.AcademicYear == year, ct)
            ?? throw Errors.Validation($"Session for year {year} not found.");

        session.Status = SessionStatus.Archived;
        session.ArchivedAt = now;
        session.StartsAt = null;

        // Prune unconfirmed, held, waitlisted, expired, or cancelled holds so only confirmed students remain
        var pruned = await db.Holds
            .Where(h => h.AcademicYear == year && h.Status != HoldStatus.Confirmed)
            .ExecuteDeleteAsync(ct);

        var retained = await db.Holds
            .CountAsync(h => h.AcademicYear == year && h.Status == HoldStatus.Confirmed, ct);

        await db.SaveChangesAsync(ct);
        await cache.InvalidateAsync([]);

        return new ArchiveSessionResponse(
            year,
            session.Title,
            pruned,
            retained,
            $"Session {session.Title} archived. Stopped taking students. Pruned {pruned} unconfirmed records; retained {retained} confirmed admitted students.");
    }

    public async Task<AcademicSessionDetail> ActivateSessionAsync(int year, CancellationToken ct)
    {
        var now = clock.UtcNowForDb();
        var session = await db.Sessions.SingleOrDefaultAsync(s => s.AcademicYear == year, ct)
            ?? throw Errors.Validation($"Session for year {year} not found.");

        if (session.Status != SessionStatus.Active)
        {
            var currentActives = await db.Sessions
                .Where(s => s.Status == SessionStatus.Active && s.AcademicYear != year)
                .ToListAsync(ct);

            foreach (var ca in currentActives)
            {
                ca.Status = SessionStatus.Archived;
                ca.ArchivedAt = now;
                await db.Holds
                    .Where(h => h.AcademicYear == ca.AcademicYear && h.Status != HoldStatus.Confirmed)
                    .ExecuteDeleteAsync(ct);
            }

            session.Status = SessionStatus.Active;
            session.StartsAt = null;
            session.ArchivedAt = null;
            await db.SaveChangesAsync(ct);
            await cache.InvalidateAsync([]);
        }

        return await MapSessionDetailAsync(session, now, ct);
    }

    private async Task<AcademicSessionDetail> MapSessionDetailAsync(AcademicSession s, DateTimeOffset now, CancellationToken ct)
    {
        var classes = await db.Classes.AsNoTracking().Where(c => c.AcademicYear == s.AcademicYear).ToListAsync(ct);
        var totalCapacity = classes.Sum(c => c.TotalSeats);
        var confirmed = await db.Holds.CountAsync(h => h.AcademicYear == s.AcademicYear && h.Status == HoldStatus.Confirmed, ct);
        var held = await db.Holds.CountAsync(h => h.AcademicYear == s.AcademicYear && h.Status == HoldStatus.Held && h.ExpiresAt > now, ct);
        var waitlist = await db.Holds.CountAsync(h => h.AcademicYear == s.AcademicYear && h.Status == HoldStatus.Waitlisted, ct);

        return new AcademicSessionDetail(
            s.AcademicYear,
            s.Title,
            s.Status.ToCode(),
            s.StartsAt?.UtcDateTime,
            s.CreatedAt.UtcDateTime,
            s.ArchivedAt?.UtcDateTime,
            classes.Count,
            totalCapacity,
            confirmed,
            held,
            waitlist,
            s.Notes
        );
    }
}

