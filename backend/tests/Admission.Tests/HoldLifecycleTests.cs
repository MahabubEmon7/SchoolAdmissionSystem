using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Admission.Api.Contracts;
using Admission.Tests.Infrastructure;

namespace Admission.Tests;

public sealed class HoldLifecycleTests(ApiFixture api) : IClassFixture<ApiFixture>
{
    [Fact]
    public async Task Create_class_returns_the_contract_shape()
    {
        var response = await api.Client.PostAsJsonAsync("/classes",
            new { name = "  Class 6 - Morning Shift ", totalSeats = 120 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Class 6 - Morning Shift", body.GetProperty("name").GetString());
        Assert.Equal(120, body.GetProperty("totalSeats").GetInt32());
        var id = body.GetProperty("id").GetString()!;

        var listed = await api.Client.GetFromJsonAsync<JsonElement>($"/classes/{id}");
        foreach (var field in new[] { "id", "name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats" })
            Assert.True(listed.TryGetProperty(field, out _), $"missing {field}");
        Assert.Equal(120, listed.GetProperty("availableSeats").GetInt32());
    }

    [Theory]
    [InlineData("", 10)]
    [InlineData("Class 7", 0)]
    [InlineData("Class 7", -3)]
    public async Task Create_class_rejects_invalid_input(string name, int totalSeats)
    {
        var response = await api.Client.PostAsJsonAsync("/classes", new { name, totalSeats });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_ERROR", await response.ErrorCodeAsync());
    }

    [Fact]
    public async Task Malformed_json_returns_a_json_400()
    {
        var response = await api.Client.PostAsync("/classes",
            new StringContent("{ \"name\": ", System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("INVALID_REQUEST", await response.ErrorCodeAsync());
    }

    [Theory]
    [InlineData("")]
    [InlineData("1234567890123456")]   // 16 digits
    [InlineData("123456789012345678")] // 18 digits
    [InlineData("1234567890123456a")]
    public async Task Student_endpoints_reject_an_invalid_birth_registration_number(string studentId)
    {
        var created = await api.CreateClassAsync(totalSeats: 3);

        var response = await api.Client.ApplyAsync(created.Id, studentId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("INVALID_STUDENT_ID", await response.ErrorCodeAsync());
    }

    [Fact]
    public async Task Paying_confirms_the_hold_and_repeating_it_is_idempotent()
    {
        var created = await api.CreateClassAsync(totalSeats: 3);
        var student = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(created.Id, student);
        Assert.Equal("HELD", hold.Status);
        Assert.Equal(student, hold.StudentId);

        for (var attempt = 0; attempt < 3; attempt++)
        {
            var confirm = await api.Client.ConfirmAsync(hold.HoldId, student);
            Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
            var body = await confirm.Content.ReadFromJsonAsync<HoldConfirmedResponse>();
            Assert.Equal(new HoldConfirmedResponse(hold.HoldId, "CONFIRMED", "Test Student", 10), body);
        }

        var seats = await api.Client.GetClassAsync(created.Id);
        Assert.Equal((0, 1, 2), (seats.HeldSeats, seats.ConfirmedSeats, seats.AvailableSeats));
        var status = await api.Client.GetFromJsonAsync<HoldResponse>($"/holds/{hold.HoldId}");
        Assert.Equal("CONFIRMED", status!.Status);
    }

    [Fact]
    public async Task Cancelling_frees_the_seat_and_lets_the_student_apply_again()
    {
        var created = await api.CreateClassAsync(totalSeats: 1);
        var student = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(created.Id, student);

        var full = await api.Client.ApplyAsync(created.Id, HttpExtensions.NewStudentId());
        Assert.Equal("SEATS_FULL", await full.ErrorCodeAsync());

        Assert.Equal(HttpStatusCode.NoContent, (await api.Client.CancelAsync(hold.HoldId, student)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await api.Client.CancelAsync(hold.HoldId, student)).StatusCode);
        Assert.Equal(1, (await api.Client.GetClassAsync(created.Id)).AvailableSeats);

        var confirmCancelled = await api.Client.ConfirmAsync(hold.HoldId, student);
        Assert.Equal("HOLD_CANCELLED", await confirmCancelled.ErrorCodeAsync());

        await api.Client.ApplyOkAsync(created.Id, student);
    }

    [Fact]
    public async Task Only_the_owner_can_confirm_or_cancel_a_hold()
    {
        var created = await api.CreateClassAsync(totalSeats: 2);
        var owner = HttpExtensions.NewStudentId();
        var stranger = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(created.Id, owner);

        Assert.Equal(HttpStatusCode.Forbidden, (await api.Client.ConfirmAsync(hold.HoldId, stranger)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.Client.CancelAsync(hold.HoldId, stranger)).StatusCode);
        Assert.Equal(1, (await api.Client.GetClassAsync(created.Id)).HeldSeats);
    }

    [Fact]
    public async Task A_student_can_hold_only_one_class_at_a_time()
    {
        var first = await api.CreateClassAsync(totalSeats: 5);
        var second = await api.CreateClassAsync(totalSeats: 5);
        var student = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(first.Id, student);

        var other = await api.Client.ApplyAsync(second.Id, student);
        Assert.Equal(HttpStatusCode.Conflict, other.StatusCode);
        var error = await other.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("ALREADY_APPLIED", error!.Error);
        Assert.Contains(first.Name, error.Message);
        Assert.Equal("ALREADY_APPLIED", await (await api.Client.JoinWaitlistAsync(second.Id, student)).ErrorCodeAsync());

        // A confirmed seat keeps blocking; a cancelled application frees the student.
        await api.Client.ConfirmAsync(hold.HoldId, student);
        Assert.Equal(HttpStatusCode.Conflict, (await api.Client.ApplyAsync(second.Id, student)).StatusCode);

        var third = await api.CreateClassAsync(totalSeats: 5);
        var otherStudent = HttpExtensions.NewStudentId();
        var firstChoice = await api.Client.ApplyOkAsync(third.Id, otherStudent);
        await api.Client.CancelAsync(firstChoice.HoldId, otherStudent);
        await api.Client.ApplyOkAsync(second.Id, otherStudent);
    }

    [Fact]
    public async Task My_holds_lists_the_students_applications_with_class_names()
    {
        var morning = await api.CreateClassAsync(totalSeats: 5);
        var day = await api.CreateClassAsync(totalSeats: 5);
        var student = HttpExtensions.NewStudentId();
        var first = await api.Client.ApplyOkAsync(morning.Id, student);
        await api.Client.CancelAsync(first.HoldId, student);
        var second = await api.Client.ApplyOkAsync(day.Id, student);
        await api.Client.ConfirmAsync(second.HoldId, student);

        var response = await api.Client.MyHoldsAsync(student);
        var holds = await response.Content.ReadFromJsonAsync<List<StudentHoldResponse>>();

        Assert.Equal(2, holds!.Count);
        Assert.Equal((day.Name, "CONFIRMED"), (holds[0].ClassName, holds[0].Status)); // newest first
        Assert.Equal((morning.Name, "CANCELLED"), (holds[1].ClassName, holds[1].Status));
        Assert.Empty((await (await api.Client.MyHoldsAsync(HttpExtensions.NewStudentId()))
            .Content.ReadFromJsonAsync<List<StudentHoldResponse>>())!);
    }

    [Fact]
    public async Task Unknown_ids_return_404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client.GetAsync($"/classes/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client.GetAsync($"/holds/{Guid.NewGuid()}")).StatusCode);
        var apply = await api.Client.ApplyAsync(Guid.NewGuid(), HttpExtensions.NewStudentId());
        Assert.Equal("CLASS_NOT_FOUND", await apply.ErrorCodeAsync());
    }

    [Fact]
    public async Task Confirm_requires_student_name_and_age_and_records_them()
    {
        var created = await api.CreateClassAsync(totalSeats: 2);
        var student = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(created.Id, student);

        var confirmRes = await api.Client.ConfirmAsync(hold.HoldId, student, studentName: "Rahim Ahmed", age: 11);
        Assert.Equal(HttpStatusCode.OK, confirmRes.StatusCode);
        var confirmed = await confirmRes.Content.ReadFromJsonAsync<HoldConfirmedResponse>();
        Assert.NotNull(confirmed);
        Assert.Equal("CONFIRMED", confirmed.Status);
        Assert.Equal("Rahim Ahmed", confirmed.StudentName);
        Assert.Equal(11, confirmed.Age);

        // Verify /me/holds returns the name and age
        var myHold = await api.Client.MyHoldAsync(student, hold.HoldId);
        Assert.Equal("Rahim Ahmed", myHold.StudentName);
        Assert.Equal(11, myHold.Age);
        Assert.Equal(2026, myHold.AcademicYear);
    }

    [Fact]
    public async Task Confirm_rejects_missing_or_invalid_student_info()
    {
        var created = await api.CreateClassAsync(totalSeats: 3);
        var student = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(created.Id, student);

        // Missing name and age
        var missingInfo = await api.Client.ConfirmAsync(hold.HoldId, student, studentName: null, age: null);
        Assert.Equal(HttpStatusCode.BadRequest, missingInfo.StatusCode);
        Assert.Equal("INVALID_STUDENT_INFO", await missingInfo.ErrorCodeAsync());

        // Blank name
        var blankName = await api.Client.ConfirmAsync(hold.HoldId, student, studentName: "   ", age: 10);
        Assert.Equal(HttpStatusCode.BadRequest, blankName.StatusCode);
        Assert.Equal("INVALID_STUDENT_INFO", await blankName.ErrorCodeAsync());

        // Underage (< 3)
        var tooYoung = await api.Client.ConfirmAsync(hold.HoldId, student, studentName: "Baby John", age: 2);
        Assert.Equal(HttpStatusCode.BadRequest, tooYoung.StatusCode);
        Assert.Equal("INVALID_STUDENT_INFO", await tooYoung.ErrorCodeAsync());

        // Overage (> 25)
        var tooOld = await api.Client.ConfirmAsync(hold.HoldId, student, studentName: "Adult John", age: 26);
        Assert.Equal(HttpStatusCode.BadRequest, tooOld.StatusCode);
        Assert.Equal("INVALID_STUDENT_INFO", await tooOld.ErrorCodeAsync());
    }

    [Fact]
    public async Task Past_years_retention_only_preserves_confirmed_students()
    {
        // Session 2025 is archived by default, activate it to allow applications
        await api.Client.PostAsync("/admin/sessions/2025/activate", null);

        // Create a past year class (e.g. 2025)
        var pastClassRes = await api.Client.PostAsJsonAsync("/classes",
            new { grade = 11, shift = "MORNING", totalSeats = 5, academicYear = 2025 });
        Assert.Equal(HttpStatusCode.Created, pastClassRes.StatusCode);
        var pastClass = (await pastClassRes.Content.ReadFromJsonAsync<ClassCreatedResponse>())!;
        Assert.Equal(2025, pastClass.AcademicYear);

        var admittedStudent = HttpExtensions.NewStudentId();
        var cancelledStudent = HttpExtensions.NewStudentId();

        var admittedHold = await api.Client.ApplyOkAsync(pastClass.Id, admittedStudent);
        await api.Client.ConfirmAsync(admittedHold.HoldId, admittedStudent, studentName: "Admitted Past", age: 15);

        var cancelledHold = await api.Client.ApplyOkAsync(pastClass.Id, cancelledStudent);
        await api.Client.CancelAsync(cancelledHold.HoldId, cancelledStudent);

        // Archive session 2025
        var archiveRes = await api.Client.PostAsync("/admin/sessions/2025/archive", null);
        Assert.Equal(HttpStatusCode.OK, archiveRes.StatusCode);
        var archiveData = await archiveRes.Content.ReadFromJsonAsync<ArchiveSessionResponse>();
        Assert.True(archiveData!.PrunedCount >= 1);

        // Verify: admitted student still exists in past year ledger, cancelled does not
        var applications = await api.Client.GetFromJsonAsync<List<AdminHoldDetail>>("/admin/applications?year=2025");
        Assert.NotNull(applications);
        Assert.Contains(applications, a => a.StudentId == admittedStudent && a.Status == "CONFIRMED");
        Assert.DoesNotContain(applications, a => a.StudentId == cancelledStudent);

        // Restore session 2026 as active
        await api.Client.PostAsync("/admin/sessions/2026/activate", null);
    }

    [Fact]
    public async Task Upcoming_session_blocks_application_before_exact_starts_at()
    {
        var futureDate = DateTimeOffset.UtcNow.AddDays(7);
        var sessionRes = await api.Client.PostAsJsonAsync("/admin/sessions", new
        {
            academicYear = 2028,
            title = "Academic Session 2028–2029",
            status = "UPCOMING",
            startsAt = futureDate,
        });
        Assert.Equal(HttpStatusCode.Created, sessionRes.StatusCode);

        var classRes = await api.Client.PostAsJsonAsync("/classes", new
        {
            grade = 3,
            shift = "MORNING",
            totalSeats = 30,
            academicYear = 2028,
        });
        Assert.Equal(HttpStatusCode.Created, classRes.StatusCode);
        var createdClass = (await classRes.Content.ReadFromJsonAsync<ClassCreatedResponse>())!;

        var student = HttpExtensions.NewStudentId();
        var apply = await api.Client.ApplyAsync(createdClass.Id, student);
        Assert.Equal(HttpStatusCode.BadRequest, apply.StatusCode);
        var err = await apply.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Contains("have not started yet", err!.Message);
    }

    [Fact]
    public async Task Archived_session_stops_taking_students_and_preserves_only_confirmed()
    {
        var sessionRes = await api.Client.PostAsJsonAsync("/admin/sessions", new
        {
            academicYear = 2029,
            title = "Academic Session 2029–2030",
            status = "ACTIVE",
        });
        Assert.Equal(HttpStatusCode.Created, sessionRes.StatusCode);

        var classRes = await api.Client.PostAsJsonAsync("/classes", new
        {
            grade = 4,
            shift = "DAY",
            totalSeats = 10,
            academicYear = 2029,
        });
        var createdClass = (await classRes.Content.ReadFromJsonAsync<ClassCreatedResponse>())!;

        var studentA = HttpExtensions.NewStudentId();
        var holdA = await api.Client.ApplyOkAsync(createdClass.Id, studentA);
        await api.Client.ConfirmAsync(holdA.HoldId, studentA, "Confirmed Student", 9);

        var studentB = HttpExtensions.NewStudentId();
        await api.Client.ApplyOkAsync(createdClass.Id, studentB);

        // Archive session 2029
        var archiveRes = await api.Client.PostAsync("/admin/sessions/2029/archive", null);
        Assert.Equal(HttpStatusCode.OK, archiveRes.StatusCode);
        var archData = await archiveRes.Content.ReadFromJsonAsync<ArchiveSessionResponse>();
        Assert.NotNull(archData);
        Assert.Equal(1, archData.AdmittedRetainedCount);
        Assert.Equal(1, archData.PrunedCount);

        // Try applying after archive: rejected
        var studentC = HttpExtensions.NewStudentId();
        var tryApply = await api.Client.ApplyAsync(createdClass.Id, studentC);
        Assert.Equal(HttpStatusCode.BadRequest, tryApply.StatusCode);
        var err = await tryApply.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Contains("closed and archived", err!.Message);
    }
}
