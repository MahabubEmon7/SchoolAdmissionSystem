using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Admission.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AcademicSessionsLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "academic_sessions",
                columns: table => new
                {
                    academic_year = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    archived_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_academic_sessions", x => x.academic_year);
                    table.CheckConstraint("ck_sessions_status", "status IN ('UPCOMING', 'ACTIVE', 'ARCHIVED')");
                    table.CheckConstraint("ck_sessions_upcoming_starts_at", "status != 'UPCOMING' OR starts_at IS NOT NULL");
                    table.CheckConstraint("ck_sessions_year_range", "academic_year BETWEEN 2020 AND 2100");
                });

            // Seed existing sessions for 2026 and 2025
            migrationBuilder.Sql(@"
                INSERT INTO academic_sessions (academic_year, title, status, created_at)
                VALUES 
                    (2026, 'Academic Session 2026–2027', 'ACTIVE', NOW()),
                    (2025, 'Academic Session 2025–2026', 'ARCHIVED', NOW())
                ON CONFLICT (academic_year) DO NOTHING;
            ");

            // Seed any other academic_years present in classes or holds
            migrationBuilder.Sql(@"
                INSERT INTO academic_sessions (academic_year, title, status, created_at)
                SELECT DISTINCT c.academic_year, 'Academic Session ' || c.academic_year || '–' || (c.academic_year + 1), 'ARCHIVED', NOW()
                FROM classes c
                WHERE NOT EXISTS (SELECT 1 FROM academic_sessions s WHERE s.academic_year = c.academic_year);
            ");

            migrationBuilder.AddForeignKey(
                name: "fk_classes_academic_sessions_academic_year",
                table: "classes",
                column: "academic_year",
                principalTable: "academic_sessions",
                principalColumn: "academic_year",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_holds_academic_sessions_academic_year",
                table: "holds",
                column: "academic_year",
                principalTable: "academic_sessions",
                principalColumn: "academic_year",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_holds_academic_sessions_academic_year",
                table: "holds");

            migrationBuilder.DropForeignKey(
                name: "fk_classes_academic_sessions_academic_year",
                table: "classes");

            migrationBuilder.DropTable(
                name: "academic_sessions");
        }
    }
}

