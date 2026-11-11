using Admission.Api.Contracts;
using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Admission.Api.Services;

/// <summary>Creating classes (Class 1–12, Morning or Day shift) and reading live seat counts.</summary>
public sealed class ClassService(AdmissionDbContext db, TimeProvider clock, ISeatCache cache, SeatLedger ledger)
{
    public async Task<ClassCreatedResponse> CreateClassAsync(CreateClassRequest request, CancellationToken ct)
    {
        var (grade, shift) = ReadGradeAndShift(request);
        var year = request.AcademicYear is > 0 ? request.AcademicYear.Value : SchoolClass.DefaultAcademicYear;

        if (!SchoolClass.IsValidAcademicYear(year))
            throw Errors.Validation($"Academic year must be between {SchoolClass.MinAcademicYear} and {SchoolClass.MaxAcademicYear}.");

        if (request.TotalSeats is not (>= 1 and <= SchoolClass.MaxSeats))
            throw Errors.Validation($"Total seats must be a whole number from 1 to {SchoolClass.MaxSeats:N0}.");

        var name = SchoolClass.DisplayName(grade, shift);
        if (await db.Classes.AnyAsync(c => c.AcademicYear == year && c.Grade == grade && c.Shift == shift, ct))
            throw Errors.ClassExists($"{name} ({year})");

        // Ensure session exists for this academic year so foreign key integrity is preserved
        if (!await db.Sessions.AnyAsync(s => s.AcademicYear == year, ct))
        {
            db.Sessions.Add(new AcademicSession
            {
                AcademicYear = year,
                Title = $"Academic Session {year}–{year + 1}",
                Status = year == SchoolClass.DefaultAcademicYear ? SessionStatus.Active : SessionStatus.Archived,
                CreatedAt = clock.UtcNowForDb(),
            });
        }

        var created = new SchoolClass
        {
            Id = Guid.NewGuid(),
            AcademicYear = year,
            Grade = grade,
            Shift = shift,
            Name = name,
            TotalSeats = request.TotalSeats.Value,
            CreatedAt = clock.UtcNowForDb(),
        };
        db.Classes.Add(created);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw Errors.ClassExists($"{name} ({year})"); // lost a race with an identical request
        }

        await cache.InvalidateAsync([created.Id]);
        return new(created.Id, created.Name, created.TotalSeats, created.Grade, created.Shift.ToCode(), created.AcademicYear);
    }

    public async Task<ClassResponse> UpdateClassSeatsAsync(Guid classId, int newTotalSeats, CancellationToken ct)
    {
        if (newTotalSeats is not (>= 1 and <= SchoolClass.MaxSeats))
            throw Errors.Validation($"Total seats must be a whole number from 1 to {SchoolClass.MaxSeats:N0}.");

        var now = clock.UtcNowForDb();
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var locked = await ledger.LockClassAsync(classId, ct)
            ?? throw Errors.ClassNotFound();

        var occupancy = await ledger.CountOccupancyAsync(classId, now, ct);

        if (newTotalSeats < occupancy.Confirmed)
            throw Errors.Validation($"Cannot reduce total capacity to {newTotalSeats} seats because {occupancy.Confirmed} {(occupancy.Confirmed == 1 ? "seat is" : "seats are")} already confirmed.");

        if (newTotalSeats < occupancy.Taken)
            throw Errors.Validation($"Cannot reduce total capacity to {newTotalSeats} seats below active holds and confirmed seats ({occupancy.Taken} seats).");

        var tracked = await db.Classes.SingleAsync(c => c.Id == classId, ct);
        tracked.TotalSeats = newTotalSeats;
        await db.SaveChangesAsync(ct);

        if (newTotalSeats > occupancy.Taken)
        {
            await ledger.PromoteWaitlistAsync(tracked, now, ct);
        }

        await tx.CommitAsync(ct);
        await cache.InvalidateAsync([classId]);

        return await GetClassAsync(classId, ct);
    }

    public async Task<IReadOnlyList<ClassResponse>> GetClassesAsync(
        int? grade = null,
        string? shift = null,
        bool? availableOnly = null,
        string? search = null,
        int? academicYear = null,
        CancellationToken ct = default)
    {
        var hasFilters = (grade.HasValue && grade.Value > 0)
            || !string.IsNullOrWhiteSpace(shift)
            || availableOnly == true
            || !string.IsNullOrWhiteSpace(search)
            || academicYear is not (null or 0); // any year filter bypasses the shared "open sessions" cache entry

        if (!hasFilters)
        {
            if (await cache.GetAsync<List<ClassResponse>>(SeatCacheKeys.AllClasses) is { } cached) return cached;
        }

        var now = clock.UtcNowForDb();
        var query = db.Classes.AsNoTracking();

        if (academicYear.HasValue && academicYear.Value > 0)
        {
            query = query.Where(c => c.AcademicYear == academicYear.Value);
        }
        else if (academicYear.HasValue && academicYear.Value == -1)
        {
            // All sessions (admin mode across active, upcoming and archived sessions)
        }
        else
        {
            var openSessions = await db.Sessions
                .Where(s => s.Status == SessionStatus.Active || s.Status == SessionStatus.Upcoming)
                .Select(s => s.AcademicYear)
                .ToListAsync(ct);

            if (openSessions.Count == 0)
            {
                // No active or upcoming session: return empty list
                return [];
            }
            query = query.Where(c => openSessions.Contains(c.AcademicYear));
        }

        if (grade is >= SchoolClass.MinGrade and <= SchoolClass.MaxGrade)
        {
            query = query.Where(c => c.Grade == grade.Value);
        }

        if (!string.IsNullOrWhiteSpace(shift) && Enum.TryParse<ClassShift>(shift, true, out var parsedShift))
        {
            query = query.Where(c => c.Shift == parsedShift);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(c => EF.Functions.ILike(c.Name, $"%{term}%"));
        }

        var projected = query
            .OrderByDescending(c => c.AcademicYear)
            .ThenBy(c => c.Grade)
            .ThenBy(c => c.Shift == ClassShift.Morning ? 0 : 1)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                c.Grade,
                c.Shift,
                c.AcademicYear,
                Held = c.Holds.Count(h => h.Status == HoldStatus.Held && h.ExpiresAt > now),
                Confirmed = c.Holds.Count(h => h.Status == HoldStatus.Confirmed),
                Waitlist = c.Holds.Count(h => h.Status == HoldStatus.Waitlisted),
            });

        if (availableOnly == true)
        {
            projected = projected.Where(c => c.TotalSeats - c.Held - c.Confirmed > 0);
        }

        var classes = await projected
            .Select(c => new ClassResponse(
                c.Id,
                c.Name,
                c.TotalSeats,
                c.Held,
                c.Confirmed,
                Math.Max(0, c.TotalSeats - c.Held - c.Confirmed),
                c.Grade,
                c.Shift.ToCode(),
                c.Waitlist,
                c.AcademicYear))
            .ToListAsync(ct);

        if (!hasFilters)
        {
            await cache.SetAsync(SeatCacheKeys.AllClasses, classes);
        }

        return classes;
    }

    public async Task<ClassResponse> GetClassAsync(Guid classId, CancellationToken ct)
    {
        var key = SeatCacheKeys.Class(classId);
        if (await cache.GetAsync<ClassResponse>(key) is { } cached) return cached;
        var found = await QueryClasses(db.Classes.Where(c => c.Id == classId)).SingleOrDefaultAsync(ct)
            ?? throw Errors.ClassNotFound();
        await cache.SetAsync(key, found);
        return found;
    }

    public async Task DeleteClassAsync(Guid classId, CancellationToken ct)
    {
        var found = await db.Classes.Include(c => c.Holds).SingleOrDefaultAsync(c => c.Id == classId, ct)
            ?? throw Errors.ClassNotFound();
        db.Holds.RemoveRange(found.Holds);
        db.Classes.Remove(found);
        await db.SaveChangesAsync(ct);
        await cache.InvalidateAsync([classId]);
    }

    private static (int Grade, ClassShift Shift) ReadGradeAndShift(CreateClassRequest request)
    {
        if (request.Grade is { } grade)
        {
            if (!SchoolClass.IsValidGrade(grade)) throw Errors.Validation("Choose a class from 1 to 12.");
            if (string.IsNullOrWhiteSpace(request.Shift))
                throw Errors.Validation("Class shift is required. Choose either 'Morning' or 'Day'.");
            return (grade, ParseShift(request.Shift));
        }

        return SchoolClass.TryParseName(request.Name, out var parsed, out var shift)
            ? (parsed, shift)
            : throw Errors.Validation("Choose a class from Class 1 to Class 12 with a valid shift, for example \"Class 6 - Morning Shift\" or \"Class 6 - Day Shift\". General/no-shift classes are not permitted.");
    }

    private static ClassShift ParseShift(string? shift) => shift?.Trim().ToUpperInvariant() switch
    {
        "MORNING" => ClassShift.Morning,
        "DAY" => ClassShift.Day,
        _ => throw Errors.Validation("Shift is required and must be either 'Morning' or 'Day'."),
    };

    private IQueryable<ClassResponse> QueryClasses(IQueryable<SchoolClass> classes)
    {
        var now = clock.UtcNowForDb();
        return classes.AsNoTracking()
            .OrderBy(c => c.Grade)
            .ThenBy(c => c.Shift == ClassShift.Morning ? 0 : 1)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                c.Grade,
                c.Shift,
                c.AcademicYear,
                Held = c.Holds.Count(h => h.Status == HoldStatus.Held && h.ExpiresAt > now),
                Confirmed = c.Holds.Count(h => h.Status == HoldStatus.Confirmed),
                Waitlist = c.Holds.Count(h => h.Status == HoldStatus.Waitlisted),
            })
            .Select(c => new ClassResponse(c.Id, c.Name, c.TotalSeats, c.Held, c.Confirmed,
                Math.Max(0, c.TotalSeats - c.Held - c.Confirmed), c.Grade,
                c.Shift.ToCode(), c.Waitlist, c.AcademicYear));
    }
}
