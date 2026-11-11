using System.Net;
using System.Net.Http.Json;
using Admission.Api.Contracts;
using Admission.Tests.Infrastructure;

namespace Admission.Tests;

public sealed class ClassCatalogTests(ApiFixture api) : IClassFixture<ApiFixture>
{
    [Fact]
    public async Task Classes_are_created_from_a_grade_and_mandatory_shift()
    {
        var response = await api.Client.PostAsJsonAsync("/classes", new { grade = 3, shift = "day", totalSeats = 40 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ClassCreatedResponse>();
        Assert.Equal(("Class 3 - Day Shift", 3, "DAY", 40),
            (created!.Name, created.Grade, created.Shift, created.TotalSeats));

        var rejected = await api.Client.PostAsJsonAsync("/classes", new { grade = 3, totalSeats = 10 });
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        Assert.Equal("VALIDATION_ERROR", await rejected.ErrorCodeAsync());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    [InlineData(-1)]
    public async Task Grades_outside_1_to_12_are_rejected(int grade)
    {
        var response = await api.Client.PostAsJsonAsync("/classes", new { grade, shift = "morning", totalSeats = 10 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_ERROR", await response.ErrorCodeAsync());
    }

    [Theory]
    [InlineData("Advanced Physics")]
    [InlineData("Class 13")]
    [InlineData("Class 6")]
    [InlineData("Class 0 - Morning Shift")]
    [InlineData("Class 4 - Night Shift")]
    public async Task Names_must_describe_class_1_to_12(string name)
    {
        var response = await api.Client.PostAsJsonAsync("/classes", new { name, totalSeats = 10 });

        Assert.Equal("VALIDATION_ERROR", await response.ErrorCodeAsync());
    }

    [Fact]
    public async Task The_same_grade_and_shift_cannot_be_created_twice()
    {
        Assert.Equal(HttpStatusCode.Created,
            (await api.Client.PostAsJsonAsync("/classes", new { grade = 8, shift = "MORNING", totalSeats = 5 })).StatusCode);

        var duplicate = await api.Client.PostAsJsonAsync("/classes", new { name = "class 8 morning", totalSeats = 9 });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("CLASS_EXISTS", await duplicate.ErrorCodeAsync());

        Assert.Equal(HttpStatusCode.Created,
            (await api.Client.PostAsJsonAsync("/classes", new { grade = 8, shift = "DAY", totalSeats = 5 })).StatusCode);
    }

    [Fact]
    public async Task Classes_are_listed_by_grade_then_shift()
    {
        foreach (var (grade, shift) in new[] { (11, "DAY"), (10, "MORNING"), (11, "MORNING"), (10, "DAY") })
            (await api.Client.PostAsJsonAsync("/classes", new { grade, shift, totalSeats = 5 })).EnsureSuccessStatusCode();

        var names = (await api.Client.GetFromJsonAsync<List<ClassResponse>>("/classes"))!
            .Where(c => c.Grade >= 10).Select(c => c.Name).ToList();

        Assert.Equal(["Class 10 - Morning Shift", "Class 10 - Day Shift", "Class 11 - Morning Shift", "Class 11 - Day Shift"], names);
    }

    [Fact]
    public async Task Class_capacity_can_be_edited_server_side()
    {
        var created = (await (await api.Client.PostAsJsonAsync("/classes",
            new { grade = 4, shift = "MORNING", totalSeats = 25 })).Content.ReadFromJsonAsync<ClassCreatedResponse>())!;

        var updateResponse = await api.Client.PatchAsJsonAsync($"/classes/{created.Id}", new { totalSeats = 45 });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updated = await updateResponse.Content.ReadFromJsonAsync<ClassResponse>();
        Assert.Equal(45, updated!.TotalSeats);
        Assert.Equal(45, updated.AvailableSeats);
    }

    [Fact]
    public async Task Classes_can_be_filtered_server_side()
    {
        (await api.Client.PostAsJsonAsync("/classes", new { grade = 2, shift = "MORNING", totalSeats = 30 })).EnsureSuccessStatusCode();
        (await api.Client.PostAsJsonAsync("/classes", new { grade = 2, shift = "DAY", totalSeats = 35 })).EnsureSuccessStatusCode();

        var morningOnly = await api.Client.GetFromJsonAsync<List<ClassResponse>>("/classes?grade=2&shift=MORNING");
        Assert.Single(morningOnly!);
        Assert.Equal("Class 2 - Morning Shift", morningOnly![0].Name);

        var dayOnly = await api.Client.GetFromJsonAsync<List<ClassResponse>>("/classes?grade=2&shift=DAY");
        Assert.Single(dayOnly!);
        Assert.Equal("Class 2 - Day Shift", dayOnly![0].Name);
    }
}
