using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Admission.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class YearlyAdmissionAndStudentInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Update classes: Drop old unique index, add academic_year, add constraint, add new unique index
            migrationBuilder.DropIndex(
                name: "ux_classes_grade_shift",
                table: "classes");

            migrationBuilder.AddColumn<int>(
                name: "academic_year",
                table: "classes",
                type: "integer",
                nullable: false,
                defaultValue: 2026);

            migrationBuilder.AddCheckConstraint(
                name: "ck_classes_academic_year",
                table: "classes",
                sql: "academic_year BETWEEN 2020 AND 2100");

            migrationBuilder.CreateIndex(
                name: "ux_classes_year_grade_shift",
                table: "classes",
                columns: new[] { "academic_year", "grade", "shift" },
                unique: true);

            // Update holds: Drop old single-year unique index, add academic_year, student_name, age
            migrationBuilder.DropIndex(
                name: "ux_holds_one_active_per_student",
                table: "holds");

            migrationBuilder.AddColumn<int>(
                name: "academic_year",
                table: "holds",
                type: "integer",
                nullable: false,
                defaultValue: 2026);

            migrationBuilder.AddColumn<string>(
                name: "student_name",
                table: "holds",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "age",
                table: "holds",
                type: "integer",
                nullable: true);

            // Backfill holds.academic_year from referenced class
            migrationBuilder.Sql("UPDATE holds h SET academic_year = c.academic_year FROM classes c WHERE h.class_id = c.id;");

            // Backfill student info for any pre-existing CONFIRMED holds so constraint passes
            migrationBuilder.Sql("UPDATE holds SET student_name = 'Admitted Student', age = 10 WHERE status = 'CONFIRMED' AND (student_name IS NULL OR age IS NULL);");

            migrationBuilder.AddCheckConstraint(
                name: "ck_holds_academic_year",
                table: "holds",
                sql: "academic_year BETWEEN 2020 AND 2100");

            migrationBuilder.AddCheckConstraint(
                name: "ck_holds_age_range",
                table: "holds",
                sql: "age IS NULL OR (age >= 3 AND age <= 25)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_holds_confirmed_has_info",
                table: "holds",
                sql: "status != 'CONFIRMED' OR (student_name IS NOT NULL AND age IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "ux_holds_one_active_per_student_year",
                table: "holds",
                columns: new[] { "student_id", "academic_year" },
                unique: true,
                filter: "status IN ('WAITLISTED', 'HELD', 'CONFIRMED')");

            migrationBuilder.CreateIndex(
                name: "ix_holds_academic_year_status",
                table: "holds",
                columns: new[] { "academic_year", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_holds_academic_year_status",
                table: "holds");

            migrationBuilder.DropIndex(
                name: "ux_holds_one_active_per_student_year",
                table: "holds");

            migrationBuilder.DropCheckConstraint(
                name: "ck_holds_confirmed_has_info",
                table: "holds");

            migrationBuilder.DropCheckConstraint(
                name: "ck_holds_age_range",
                table: "holds");

            migrationBuilder.DropCheckConstraint(
                name: "ck_holds_academic_year",
                table: "holds");

            migrationBuilder.DropColumn(
                name: "age",
                table: "holds");

            migrationBuilder.DropColumn(
                name: "student_name",
                table: "holds");

            migrationBuilder.DropColumn(
                name: "academic_year",
                table: "holds");

            migrationBuilder.CreateIndex(
                name: "ux_holds_one_active_per_student",
                table: "holds",
                column: "student_id",
                unique: true,
                filter: "status IN ('WAITLISTED', 'HELD', 'CONFIRMED')");

            migrationBuilder.DropIndex(
                name: "ux_classes_year_grade_shift",
                table: "classes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_classes_academic_year",
                table: "classes");

            migrationBuilder.DropColumn(
                name: "academic_year",
                table: "classes");

            migrationBuilder.CreateIndex(
                name: "ux_classes_grade_shift",
                table: "classes",
                columns: new[] { "grade", "shift" },
                unique: true);
        }
    }
}

