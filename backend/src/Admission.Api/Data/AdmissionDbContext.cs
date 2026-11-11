using Admission.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Admission.Api.Data;

public sealed class AdmissionDbContext(DbContextOptions<AdmissionDbContext> options) : DbContext(options)
{
    public DbSet<AcademicSession> Sessions => Set<AcademicSession>();
    public DbSet<SchoolClass> Classes => Set<SchoolClass>();
    public DbSet<Hold> Holds => Set<Hold>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<AcademicSession>(entity =>
        {
            entity.ToTable("academic_sessions", table =>
            {
                table.HasCheckConstraint("ck_sessions_status", "status IN ('UPCOMING', 'ACTIVE', 'ARCHIVED')");
                table.HasCheckConstraint("ck_sessions_year_range", "academic_year BETWEEN 2020 AND 2100");
                table.HasCheckConstraint("ck_sessions_upcoming_starts_at", "status != 'UPCOMING' OR starts_at IS NOT NULL");
            });
            entity.HasKey(s => s.AcademicYear);
            entity.Property(s => s.AcademicYear).ValueGeneratedNever();
            entity.Property(s => s.Title).HasMaxLength(100).IsRequired();
            entity.Property(s => s.Status)
                .HasMaxLength(16)
                .IsRequired()
                .HasConversion(s => s.ToCode(), s => SessionStatusExtensions.ParseSessionStatus(s));
            entity.Property(s => s.Notes).HasMaxLength(500);

            entity.HasMany(s => s.Classes).WithOne().HasForeignKey(c => c.AcademicYear).OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(s => s.Holds).WithOne().HasForeignKey(h => h.AcademicYear).OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<SchoolClass>(entity =>
        {
            entity.ToTable("classes", table =>
            {
                table.HasCheckConstraint("ck_classes_total_seats_positive", "total_seats > 0");
                table.HasCheckConstraint("ck_classes_grade_range", "grade BETWEEN 1 AND 12");
                table.HasCheckConstraint("ck_classes_shift", "shift IN ('MORNING', 'DAY')");
                table.HasCheckConstraint("ck_classes_academic_year", "academic_year BETWEEN 2020 AND 2100");
            });
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Name).HasMaxLength(100).IsRequired();
            entity.Property(c => c.AcademicYear).HasDefaultValue(SchoolClass.DefaultAcademicYear).IsRequired();
            entity.Property(c => c.Shift)
                .HasMaxLength(16)
                .IsRequired()
                .HasConversion(s => s.ToCode(), s => Enum.Parse<ClassShift>(s, true));

            // Exactly one Morning Shift and one Day Shift per grade for any given academic year.
            entity.HasIndex(c => new { c.AcademicYear, c.Grade, c.Shift })
                .IsUnique()
                .HasDatabaseName("ux_classes_year_grade_shift");
            entity.HasIndex(c => c.CreatedAt);
        });

        model.Entity<Hold>(entity =>
        {
            entity.ToTable("holds", table =>
            {
                table.HasCheckConstraint("ck_holds_student_id_format", "student_id ~ '^[0-9]{17}$'");
                table.HasCheckConstraint("ck_holds_status",
                    "status IN ('WAITLISTED', 'HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
                table.HasCheckConstraint("ck_holds_deadline",
                    "expires_at IS NOT NULL OR status IN ('WAITLISTED', 'CANCELLED')");
                table.HasCheckConstraint("ck_holds_academic_year", "academic_year BETWEEN 2020 AND 2100");
                table.HasCheckConstraint("ck_holds_age_range", "age IS NULL OR (age >= 3 AND age <= 25)");
            });
            entity.HasKey(h => h.Id);
            entity.Property(h => h.QueueNumber).UseIdentityAlwaysColumn();
            entity.Property(h => h.StudentId).HasMaxLength(StudentId.Length).IsFixedLength().IsRequired();
            entity.Property(h => h.AcademicYear).HasDefaultValue(SchoolClass.DefaultAcademicYear).IsRequired();
            entity.Property(h => h.StudentName).HasMaxLength(100);
            entity.Property(h => h.Age);
            entity.Property(h => h.Status)
                .HasMaxLength(16)
                .HasConversion(s => s.ToCode(), s => Enum.Parse<HoldStatus>(s, true));

            entity.HasOne(h => h.Class).WithMany(c => c.Holds).HasForeignKey(h => h.ClassId);

            // Backstop for "one active application per student per academic year".
            entity.HasIndex(h => new { h.StudentId, h.AcademicYear })
                .IsUnique()
                .HasFilter("status IN ('WAITLISTED', 'HELD', 'CONFIRMED')")
                .HasDatabaseName("ux_holds_one_active_per_student_year");

            // Seat counting, the expiry sweep, and waitlist order.
            entity.HasIndex(h => new { h.ClassId, h.Status, h.ExpiresAt });
            entity.HasIndex(h => h.ExpiresAt).HasFilter("status = 'HELD'");
            entity.HasIndex(h => new { h.ClassId, h.QueueNumber })
                .HasFilter("status = 'WAITLISTED'")
                .HasDatabaseName("ix_holds_waitlist_order");
            entity.HasIndex(h => new { h.StudentId, h.CreatedAt });
            entity.HasIndex(h => new { h.AcademicYear, h.Status }).HasDatabaseName("ix_holds_academic_year_status");
        });
    }
}
