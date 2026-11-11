using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Admission.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropConfirmedStudentInfoConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_holds_confirmed_has_info",
                table: "holds");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "ck_holds_confirmed_has_info",
                table: "holds",
                sql: "status != 'CONFIRMED' OR (student_name IS NOT NULL AND age IS NOT NULL)");
        }
    }
}

