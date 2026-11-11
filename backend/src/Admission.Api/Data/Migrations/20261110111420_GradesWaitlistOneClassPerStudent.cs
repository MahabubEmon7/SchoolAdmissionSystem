using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Admission.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class GradesWaitlistOneClassPerStudent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_holds_one_active_per_student",
                table: "holds");

            migrationBuilder.DropCheckConstraint(
                name: "ck_holds_status",
                table: "holds");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "expires_at",
                table: "holds",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<long>(
                name: "queue_number",
                table: "holds",
                type: "bigint",
                nullable: false,
                defaultValue: 0L)
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn);

            migrationBuilder.AddColumn<int>(
                name: "grade",
                table: "classes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "shift",
                table: "classes",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            // Existing classes: read grade and shift from names like "Class 6 - Morning Shift" and
            // store the canonical name. Stops with a clear message if a name can't be read.
            migrationBuilder.Sql("""
                UPDATE classes SET
                    grade = COALESCE((regexp_match(name, '^\s*class\s*(\d{1,2})', 'i'))[1]::int, 0),
                    shift = CASE WHEN name ~* 'morning' THEN 'MORNING'
                                 WHEN name ~* '\mday\M' THEN 'DAY' END;
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM classes WHERE grade NOT BETWEEN 1 AND 12) THEN
                        RAISE EXCEPTION 'These class names have no grade 1-12: %. Rename them (e.g. "Class 6"), then restart.',
                            (SELECT string_agg(name, ', ') FROM classes WHERE grade NOT BETWEEN 1 AND 12);
                    END IF;
                    IF EXISTS (SELECT 1 FROM classes GROUP BY grade, shift HAVING count(*) > 1) THEN
                        RAISE EXCEPTION 'Two or more classes share the same grade and shift: %. Remove the duplicates, then restart.',
                            (SELECT string_agg(DISTINCT name, ', ') FROM classes c
                             WHERE (SELECT count(*) FROM classes d WHERE d.grade = c.grade
                                    AND d.shift IS NOT DISTINCT FROM c.shift) > 1);
                    END IF;
                END $$;
                UPDATE classes SET name = 'Class ' || grade || CASE shift
                    WHEN 'MORNING' THEN ' - Morning Shift' WHEN 'DAY' THEN ' - Day Shift' ELSE '' END;
                """);

            // Existing applications → new rule "one active application per student": expire overdue
            // holds, then keep a confirmed seat if there is one (else the earliest application) and
            // cancel the rest, which releases their seats.
            migrationBuilder.Sql("""
                UPDATE holds SET status = 'EXPIRED' WHERE status = 'HELD' AND expires_at <= now();
                WITH ranked AS (
                    SELECT id, row_number() OVER (
                        PARTITION BY student_id
                        ORDER BY (status = 'CONFIRMED') DESC, created_at, id) AS rn
                    FROM holds WHERE status IN ('HELD', 'CONFIRMED'))
                UPDATE holds h SET status = 'CANCELLED', cancelled_at = now()
                FROM ranked r WHERE h.id = r.id AND r.rn > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_holds_waitlist_order",
                table: "holds",
                columns: new[] { "class_id", "queue_number" },
                filter: "status = 'WAITLISTED'");

            migrationBuilder.CreateIndex(
                name: "ux_holds_one_active_per_student",
                table: "holds",
                column: "student_id",
                unique: true,
                filter: "status IN ('WAITLISTED', 'HELD', 'CONFIRMED')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_holds_deadline",
                table: "holds",
                sql: "expires_at IS NOT NULL OR status IN ('WAITLISTED', 'CANCELLED')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_holds_status",
                table: "holds",
                sql: "status IN ('WAITLISTED', 'HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");

            migrationBuilder.CreateIndex(
                name: "ux_classes_grade_shift",
                table: "classes",
                columns: new[] { "grade", "shift" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.AddCheckConstraint(
                name: "ck_classes_grade_range",
                table: "classes",
                sql: "grade BETWEEN 1 AND 12");

            migrationBuilder.AddCheckConstraint(
                name: "ck_classes_shift",
                table: "classes",
                sql: "shift IS NULL OR shift IN ('MORNING', 'DAY')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_holds_waitlist_order",
                table: "holds");

            migrationBuilder.DropIndex(
                name: "ux_holds_one_active_per_student",
                table: "holds");

            migrationBuilder.DropCheckConstraint(
                name: "ck_holds_deadline",
                table: "holds");

            migrationBuilder.DropCheckConstraint(
                name: "ck_holds_status",
                table: "holds");

            migrationBuilder.DropIndex(
                name: "ux_classes_grade_shift",
                table: "classes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_classes_grade_range",
                table: "classes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_classes_shift",
                table: "classes");

            migrationBuilder.DropColumn(
                name: "queue_number",
                table: "holds");

            migrationBuilder.DropColumn(
                name: "grade",
                table: "classes");

            migrationBuilder.DropColumn(
                name: "shift",
                table: "classes");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "expires_at",
                table: "holds",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)),
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_holds_one_active_per_student",
                table: "holds",
                columns: new[] { "class_id", "student_id" },
                unique: true,
                filter: "status IN ('HELD', 'CONFIRMED')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_holds_status",
                table: "holds",
                sql: "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
        }
    }
}
