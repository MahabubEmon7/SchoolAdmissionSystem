using Admission.Api.Contracts;
using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Admission.Api.Services;

public sealed class AdminService(AdmissionDbContext db, TimeProvider clock, ISeatCache cache)
{
    private sealed record ShiftAccumulator(int TotalSeats, int Confirmed, int Held, int Waitlist);

    public async Task<AdminStatsResponse> GetStatsAsync(int? academicYear = null, CancellationToken ct = default)
    {
        var targetYear = academicYear is > 0 ? academicYear.Value : SchoolClass.DefaultAcademicYear;
        var isArchived = targetYear < SchoolClass.DefaultAcademicYear;
        var now = clock.UtcNowForDb();

        var classes = await db.Classes.AsNoTracking()
            .Where(c => c.AcademicYear == targetYear)
            .OrderBy(c => c.Grade)
            .ThenBy(c => c.Shift == ClassShift.Morning ? 0 : 1)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Grade,
                c.Shift,
                c.AcademicYear,
                c.TotalSeats,
                Held = c.Holds.Count(h => h.Status == HoldStatus.Held && h.ExpiresAt > now),
                Confirmed = c.Holds.Count(h => h.Status == HoldStatus.Confirmed),
                Waitlist = c.Holds.Count(h => h.Status == HoldStatus.Waitlisted),
            })
            .ToListAsync(ct);

        var totalCapacity = classes.Sum(c => c.TotalSeats);
        var totalHeld = classes.Sum(c => c.Held);
        var totalConfirmed = classes.Sum(c => c.Confirmed);
        var totalAvailable = Math.Max(0, totalCapacity - totalHeld - totalConfirmed);
        var totalWaitlist = classes.Sum(c => c.Waitlist);

        var totalCancelled = await db.Holds
            .CountAsync(h => h.AcademicYear == targetYear && h.Status == HoldStatus.Cancelled, ct);

        var totalExpired = await db.Holds
            .CountAsync(h => h.AcademicYear == targetYear && (h.Status == HoldStatus.Expired || (h.Status == HoldStatus.Held && h.ExpiresAt <= now)), ct);

        var occupancyRate = totalCapacity > 0
            ? Math.Round((double)(totalConfirmed + totalHeld) / totalCapacity * 100, 1)
            : 0.0;

        var shiftStats = new List<AdminShiftStat>
        {
            CreateShiftStat("MORNING", "Morning Shift",
                classes.Where(c => c.Shift == ClassShift.Morning).Select(c => new ShiftAccumulator(c.TotalSeats, c.Confirmed, c.Held, c.Waitlist))),
            CreateShiftStat("DAY", "Day Shift",
                classes.Where(c => c.Shift == ClassShift.Day).Select(c => new ShiftAccumulator(c.TotalSeats, c.Confirmed, c.Held, c.Waitlist))),
        };

        var classStats = classes.Select(c => new AdminClassStat(
            c.Id,
            c.Name,
            c.Grade,
            c.Shift.ToCode(),
            c.TotalSeats,
            c.Held,
            c.Confirmed,
            Math.Max(0, c.TotalSeats - c.Held - c.Confirmed),
            c.Waitlist,
            c.TotalSeats > 0 ? Math.Round((double)(c.Confirmed + c.Held) / c.TotalSeats * 100, 1) : 0.0,
            c.AcademicYear
        )).ToList();

        return new AdminStatsResponse(
            totalCapacity,
            totalHeld,
            totalConfirmed,
            totalAvailable,
            totalWaitlist,
            totalCancelled,
            totalExpired,
            occupancyRate,
            classes.Count,
            shiftStats,
            classStats,
            targetYear,
            isArchived
        );
    }

    private static AdminShiftStat CreateShiftStat(string shift, string label, IEnumerable<ShiftAccumulator> items)
    {
        var list = items.ToList();
        var cap = list.Sum(x => x.TotalSeats);
        var conf = list.Sum(x => x.Confirmed);
        var held = list.Sum(x => x.Held);
        var wait = list.Sum(x => x.Waitlist);
        return new AdminShiftStat(shift, label, cap, conf, held, Math.Max(0, cap - conf - held), wait);
    }

    public async Task<IReadOnlyList<AdminHoldDetail>> GetApplicationsAsync(
        int? academicYear,
        Guid? classId,
        string? status,
        string? search,
        CancellationToken ct)
    {
        var now = clock.UtcNowForDb();
        var query = db.Holds.AsNoTracking().Include(h => h.Class).AsQueryable();

        if (academicYear.HasValue && academicYear.Value > 0)
            query = query.Where(h => h.AcademicYear == academicYear.Value);

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(h => h.ClassId == classId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(h => h.StudentId.Contains(term) || (h.StudentName != null && EF.Functions.ILike(h.StudentName, $"%{term}%")));
        }

        var holds = await query
            .OrderByDescending(h => h.CreatedAt)
            .Take(300)
            .ToListAsync(ct);

        var list = new List<AdminHoldDetail>();
        foreach (var h in holds)
        {
            var effectiveStatus = h.EffectiveStatus(now);
            if (!string.IsNullOrWhiteSpace(status) && !effectiveStatus.ToCode().Equals(status.Trim(), StringComparison.OrdinalIgnoreCase))
                continue;

            int? waitlistPos = null;
            if (effectiveStatus == HoldStatus.Waitlisted)
            {
                waitlistPos = await db.Holds.CountAsync(other => other.ClassId == h.ClassId
                    && other.Status == HoldStatus.Waitlisted
                    && other.QueueNumber < h.QueueNumber, ct) + 1;
            }

            list.Add(new AdminHoldDetail(
                h.Id,
                h.ClassId,
                h.Class?.Name ?? "Unknown",
                h.Class?.Grade ?? 0,
                h.Class != null ? h.Class.Shift.ToCode() : "MORNING",
                h.StudentId,
                effectiveStatus.ToCode(),
                h.ExpiresAt?.UtcDateTime,
                h.CreatedAt.UtcDateTime,
                h.ConfirmedAt?.UtcDateTime,
                h.CancelledAt?.UtcDateTime,
                h.QueueNumber,
                waitlistPos,
                h.StudentName,
                h.Age,
                h.AcademicYear
            ));
        }

        return list;
    }

    /// <summary>
    /// Lists all academic years present in the database, with active/archived status and counts.
    /// </summary>
    public async Task<AcademicYearsResponse> GetAcademicYearsAsync(CancellationToken ct)
    {
        var classYears = await db.Classes.Select(c => c.AcademicYear).Distinct().ToListAsync(ct);
        var holdYears = await db.Holds.Select(h => h.AcademicYear).Distinct().ToListAsync(ct);
        var allYears = classYears.Union(holdYears).ToHashSet();
        allYears.Add(SchoolClass.DefaultAcademicYear);

        var sortedYears = allYears.OrderByDescending(y => y).ToList();
        var list = new List<AcademicYearInfo>(sortedYears.Count);

        foreach (var y in sortedYears)
        {
            var classes = await db.Classes.AsNoTracking().Where(c => c.AcademicYear == y).ToListAsync(ct);
            var confirmedCount = await db.Holds.CountAsync(h => h.AcademicYear == y && h.Status == HoldStatus.Confirmed, ct);
            var totalCapacity = classes.Sum(c => c.TotalSeats);
            var isActive = y == SchoolClass.DefaultAcademicYear;

            list.Add(new AcademicYearInfo(
                y,
                $"Academic Year {y}–{y + 1}",
                isActive,
                classes.Count,
                confirmedCount,
                totalCapacity
            ));
        }

        return new AcademicYearsResponse(SchoolClass.DefaultAcademicYear, list);
    }

    /// <summary>
    /// For previous academic years (years prior to active year), ONLY keep admitted students' data.
    /// Prunes unconfirmed, held, expired, waitlisted, and cancelled holds for all past years.
    /// </summary>
    public async Task<ArchivePastYearsResponse> ArchivePastYearsAsync(int? cutoffYear = null, CancellationToken ct = default)
    {
        var cutoff = cutoffYear ?? SchoolClass.DefaultAcademicYear;
        var pruned = await db.Holds
            .Where(h => h.AcademicYear < cutoff && h.Status != HoldStatus.Confirmed)
            .ExecuteDeleteAsync(ct);

        await cache.InvalidateAsync([]);
        return new ArchivePastYearsResponse(
            pruned,
            $"Archived previous years (< {cutoff}). Retained only confirmed admitted students; purged {pruned} unconfirmed records.");
    }

    public async Task ResetDatabaseAsync(CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE holds, classes, academic_sessions CASCADE;", ct);
        db.Sessions.Add(new AcademicSession
        {
            AcademicYear = SchoolClass.DefaultAcademicYear,
            Title = $"Academic Session {SchoolClass.DefaultAcademicYear}–{SchoolClass.DefaultAcademicYear + 1}",
            Status = SessionStatus.Active,
            CreatedAt = clock.UtcNowForDb(),
        });
        await db.SaveChangesAsync(ct);
        await cache.InvalidateAsync([]);
    }

    public async Task<SeedDatabaseResponse> SeedDatabaseAsync(CancellationToken ct)
    {
        var now = clock.UtcNowForDb();

        // 1. Wipe clean
        await db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE holds, classes, academic_sessions RESTART IDENTITY CASCADE;", ct);

        // 2. Add 3 Academic Sessions: Archived (2025), Active (2026), Upcoming (2027)
        var session2025 = new AcademicSession
        {
            AcademicYear = 2025,
            Title = "Academic Session 2025–2026",
            Status = SessionStatus.Archived,
            CreatedAt = now.AddYears(-1),
            ArchivedAt = now.AddMonths(-6),
            Notes = "Completed historical admission cycle. Retains confirmed admitted students only.",
        };

        var session2026 = new AcademicSession
        {
            AcademicYear = 2026,
            Title = "Academic Session 2026–2027",
            Status = SessionStatus.Active,
            CreatedAt = now.AddMonths(-3),
            ArchivedAt = null,
            Notes = "Current active admission session. Online seat holds and waitlist queues are live.",
        };

        var session2027 = new AcademicSession
        {
            AcademicYear = 2027,
            Title = "Academic Session 2027–2028",
            Status = SessionStatus.Upcoming,
            StartsAt = now.AddDays(7),
            CreatedAt = now.AddDays(-2),
            ArchivedAt = null,
            Notes = "Official 2027–2028 admission cycle. Applications open automatically on scheduled launch date.",
        };

        db.Sessions.AddRange(session2025, session2026, session2027);

        // 3. Create Classes
        var classes2025 = new List<SchoolClass>
        {
            new() { Id = Guid.NewGuid(), AcademicYear = 2025, Grade = 1, Shift = ClassShift.Morning, Name = "Class 1 - Morning Shift", TotalSeats = 40, CreatedAt = now.AddYears(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2025, Grade = 1, Shift = ClassShift.Day, Name = "Class 1 - Day Shift", TotalSeats = 40, CreatedAt = now.AddYears(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2025, Grade = 2, Shift = ClassShift.Morning, Name = "Class 2 - Morning Shift", TotalSeats = 35, CreatedAt = now.AddYears(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2025, Grade = 2, Shift = ClassShift.Day, Name = "Class 2 - Day Shift", TotalSeats = 35, CreatedAt = now.AddYears(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2025, Grade = 3, Shift = ClassShift.Morning, Name = "Class 3 - Morning Shift", TotalSeats = 30, CreatedAt = now.AddYears(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2025, Grade = 3, Shift = ClassShift.Day, Name = "Class 3 - Day Shift", TotalSeats = 30, CreatedAt = now.AddYears(-1) },
        };

        var classes2026 = new List<SchoolClass>
        {
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 1, Shift = ClassShift.Morning, Name = "Class 1 - Morning Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 1, Shift = ClassShift.Day, Name = "Class 1 - Day Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 2, Shift = ClassShift.Morning, Name = "Class 2 - Morning Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 2, Shift = ClassShift.Day, Name = "Class 2 - Day Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 3, Shift = ClassShift.Morning, Name = "Class 3 - Morning Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 3, Shift = ClassShift.Day, Name = "Class 3 - Day Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 4, Shift = ClassShift.Morning, Name = "Class 4 - Morning Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 4, Shift = ClassShift.Day, Name = "Class 4 - Day Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 5, Shift = ClassShift.Morning, Name = "Class 5 - Morning Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 5, Shift = ClassShift.Day, Name = "Class 5 - Day Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 6, Shift = ClassShift.Morning, Name = "Class 6 - Morning Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2026, Grade = 6, Shift = ClassShift.Day, Name = "Class 6 - Day Shift", TotalSeats = 25, CreatedAt = now.AddMonths(-3) },
        };

        var classes2027 = new List<SchoolClass>
        {
            new() { Id = Guid.NewGuid(), AcademicYear = 2027, Grade = 1, Shift = ClassShift.Morning, Name = "Class 1 - Morning Shift", TotalSeats = 50, CreatedAt = now.AddDays(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2027, Grade = 1, Shift = ClassShift.Day, Name = "Class 1 - Day Shift", TotalSeats = 50, CreatedAt = now.AddDays(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2027, Grade = 2, Shift = ClassShift.Morning, Name = "Class 2 - Morning Shift", TotalSeats = 40, CreatedAt = now.AddDays(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2027, Grade = 2, Shift = ClassShift.Day, Name = "Class 2 - Day Shift", TotalSeats = 40, CreatedAt = now.AddDays(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2027, Grade = 3, Shift = ClassShift.Morning, Name = "Class 3 - Morning Shift", TotalSeats = 35, CreatedAt = now.AddDays(-1) },
            new() { Id = Guid.NewGuid(), AcademicYear = 2027, Grade = 3, Shift = ClassShift.Day, Name = "Class 3 - Day Shift", TotalSeats = 35, CreatedAt = now.AddDays(-1) },
        };

        db.Classes.AddRange(classes2025);
        db.Classes.AddRange(classes2026);
        db.Classes.AddRange(classes2027);

        // 4. Generate 300 students
        var firstNames = new[]
        {
            "Liam", "Emma", "Noah", "Olivia", "William", "Ava", "James", "Isabella", "Oliver", "Sophia",
            "Benjamin", "Charlotte", "Elijah", "Mia", "Lucas", "Amelia", "Mason", "Harper", "Logan", "Evelyn",
            "Alexander", "Abigail", "Ethan", "Emily", "Jacob", "Elizabeth", "Michael", "Mila", "Daniel", "Ella",
            "Henry", "Avery", "Jackson", "Sofia", "Sebastian", "Camila", "Aiden", "Aria", "Matthew", "Scarlett",
            "Samuel", "Victoria", "David", "Madison", "Joseph", "Luna", "Carter", "Grace", "Owen", "Chloe",
            "Wyatt", "Penelope", "John", "Layla", "Jack", "Riley", "Luke", "Zoey", "Jayden", "Nora",
            "Dylan", "Lily", "Grayson", "Eleanor", "Levi", "Hannah", "Isaac", "Lillian", "Gabriel", "Addison",
            "Julian", "Aubrey", "Mateo", "Ellie", "Anthony", "Stella", "Jaxon", "Natalie", "Lincoln", "Zoe",
            "Joshua", "Leah", "Christopher", "Hazel", "Andrew", "Violet", "Theodore", "Aurora", "Caleb", "Savannah",
            "Ryan", "Audrey", "Asher", "Brooklyn", "Nathan", "Bella", "Thomas", "Claire", "Leo", "Skylar"
        };

        var lastNames = new[]
        {
            "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
            "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
            "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
            "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
            "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"
        };

        var holds = new List<Hold>(300);

        // Cohort 2025: 100 students (all confirmed)
        for (var i = 1; i <= 100; i++)
        {
            var studentId = $"201526910000{i:D5}";
            var c = classes2025[(i - 1) % classes2025.Count];
            var fName = firstNames[(i * 7) % firstNames.Length];
            var lName = lastNames[(i * 13) % lastNames.Length];
            var age = c.Grade + 5; // e.g. Grade 1: 6 yrs, Grade 2: 7 yrs

            holds.Add(new Hold
            {
                Id = Guid.NewGuid(),
                ClassId = c.Id,
                StudentId = studentId,
                Status = HoldStatus.Confirmed,
                StudentName = $"{fName} {lName}",
                Age = age,
                AcademicYear = 2025,
                CreatedAt = now.AddMonths(-10).AddDays(i % 30),
                ConfirmedAt = now.AddMonths(-9).AddDays(i % 30),
                ExpiresAt = now.AddMonths(-9),
            });
        }

        // Cohort 2026: 200 students (140 confirmed, 35 held, 25 waitlisted)
        // 140 confirmed students: 80 in first 4 classes (20 each), 60 in remaining 8 classes
        for (var i = 101; i <= 240; i++)
        {
            var studentId = $"201526910000{i:D5}";
            var c = i <= 180
                ? classes2026[(i - 101) % 4]
                : classes2026[4 + ((i - 181) % 8)];
            var fName = firstNames[(i * 3) % firstNames.Length];
            var lName = lastNames[(i * 11) % lastNames.Length];
            var age = c.Grade + 5;

            holds.Add(new Hold
            {
                Id = Guid.NewGuid(),
                ClassId = c.Id,
                StudentId = studentId,
                Status = HoldStatus.Confirmed,
                StudentName = $"{fName} {lName}",
                Age = age,
                AcademicYear = 2026,
                CreatedAt = now.AddDays(-20).AddHours(i % 48),
                ConfirmedAt = now.AddDays(-19).AddHours(i % 48),
                ExpiresAt = now.AddDays(-19),
            });
        }

        // 35 active holds (with live 10-minute countdown)
        // 20 in first 4 classes (5 each, making them 20 confirmed + 5 held = 25/25 100% full!)
        // 15 in remaining 8 classes (plenty of seats available)
        for (var i = 241; i <= 275; i++)
        {
            var studentId = $"201526910000{i:D5}";
            var c = i <= 260
                ? classes2026[(i - 241) % 4]
                : classes2026[4 + ((i - 261) % 8)];
            var fName = firstNames[(i * 5) % firstNames.Length];
            var lName = lastNames[(i * 17) % lastNames.Length];
            var age = c.Grade + 5;

            holds.Add(new Hold
            {
                Id = Guid.NewGuid(),
                ClassId = c.Id,
                StudentId = studentId,
                Status = HoldStatus.Held,
                StudentName = $"{fName} {lName}",
                Age = age,
                AcademicYear = 2026,
                CreatedAt = now.AddMinutes(-2),
                ExpiresAt = now.AddMinutes(8), // Active countdown timer!
            });
        }

        // 25 waitlisted students queued up behind the 4 full classes!
        for (var i = 276; i <= 300; i++)
        {
            var studentId = $"201526910000{i:D5}";
            var c = classes2026[(i - 276) % 4];
            var fName = firstNames[(i * 2) % firstNames.Length];
            var lName = lastNames[(i * 19) % lastNames.Length];
            var age = c.Grade + 5;

            holds.Add(new Hold
            {
                Id = Guid.NewGuid(),
                ClassId = c.Id,
                StudentId = studentId,
                Status = HoldStatus.Waitlisted,
                StudentName = $"{fName} {lName}",
                Age = age,
                AcademicYear = 2026,
                CreatedAt = now.AddMinutes(-5),
                ExpiresAt = null,
            });
        }

        db.Holds.AddRange(holds);
        await db.SaveChangesAsync(ct);
        await cache.InvalidateAsync([]);

        return new SeedDatabaseResponse(
            TotalSessions: 3,
            TotalClasses: classes2025.Count + classes2026.Count + classes2027.Count,
            TotalStudents: holds.Count,
            ConfirmedStudents: holds.Count(h => h.Status == HoldStatus.Confirmed),
            HeldStudents: holds.Count(h => h.Status == HoldStatus.Held),
            WaitlistedStudents: holds.Count(h => h.Status == HoldStatus.Waitlisted),
            Message: "Successfully seeded 3 academic sessions and 300 students with realistic records."
        );
    }
}
