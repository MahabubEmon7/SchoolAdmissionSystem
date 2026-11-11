using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Admission.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MandatoryShiftEnumAndConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE classes SET shift = 'MORNING', name = name || ' - Morning Shift' WHERE shift IS NULL;");

            migrationBuilder.DropCheckConstraint(
                name: "ck_classes_shift",
                table: "classes");

            migrationBuilder.AlterColumn<string>(
                name: "shift",
                table: "classes",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(16)",
                oldMaxLength: 16,
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_classes_shift",
                table: "classes",
                sql: "shift IN ('MORNING', 'DAY')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_classes_shift",
                table: "classes");

            migrationBuilder.AlterColumn<string>(
                name: "shift",
                table: "classes",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(16)",
                oldMaxLength: 16);

            migrationBuilder.AddCheckConstraint(
                name: "ck_classes_shift",
                table: "classes",
                sql: "shift IS NULL OR shift IN ('MORNING', 'DAY')");
        }
    }
}

