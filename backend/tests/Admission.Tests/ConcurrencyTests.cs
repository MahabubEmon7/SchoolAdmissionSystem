using System.Net;
using Admission.Tests.Infrastructure;

namespace Admission.Tests;

public sealed class ConcurrencyTests(ApiFixture api) : IClassFixture<ApiFixture>
{
    [Fact]
    public async Task Two_hundred_simultaneous_holds_for_120_seats_admit_exactly_120()
    {
        var created = await api.CreateClassAsync(totalSeats: 120);

        var responses = await Task.WhenAll(Enumerable.Range(0, 200)
            .Select(_ => api.Client.ApplyAsync(created.Id, HttpExtensions.NewStudentId())));

        Assert.Equal(120, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(80, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        foreach (var rejected in responses.Where(r => r.StatusCode == HttpStatusCode.Conflict))
            Assert.Equal("SEATS_FULL", await rejected.ErrorCodeAsync());

        var seats = await api.Client.GetClassAsync(created.Id);
        Assert.Equal(120, seats.HeldSeats);
        Assert.Equal(0, seats.ConfirmedSeats);
        Assert.Equal(0, seats.AvailableSeats);
    }

    [Fact]
    public async Task Seat_limit_holds_across_two_api_instances_sharing_one_database()
    {
        var created = await api.CreateClassAsync(totalSeats: 50);
        var secondInstance = api.StartHost();

        var responses = await Task.WhenAll(Enumerable.Range(0, 150).Select(i =>
            (i % 2 == 0 ? api.Client : secondInstance).ApplyAsync(created.Id, HttpExtensions.NewStudentId())));

        Assert.Equal(50, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(100, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(0, (await secondInstance.GetClassAsync(created.Id)).AvailableSeats);
    }

    [Fact]
    public async Task One_student_applying_many_times_at_once_gets_one_hold()
    {
        var created = await api.CreateClassAsync(totalSeats: 10);
        var student = HttpExtensions.NewStudentId();

        var responses = await Task.WhenAll(Enumerable.Range(0, 20)
            .Select(_ => api.Client.ApplyAsync(created.Id, student)));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        foreach (var rejected in responses.Where(r => r.StatusCode != HttpStatusCode.Created))
        {
            Assert.Equal(HttpStatusCode.Conflict, rejected.StatusCode);
            Assert.Equal("ALREADY_APPLIED", await rejected.ErrorCodeAsync());
        }
        Assert.Equal(1, (await api.Client.GetClassAsync(created.Id)).HeldSeats);
    }

    [Fact]
    public async Task One_student_applying_to_many_classes_at_once_gets_one_hold()
    {
        var classes = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => api.CreateClassAsync(totalSeats: 3)));
        var student = HttpExtensions.NewStudentId();

        var responses = await Task.WhenAll(classes.Select(c => api.Client.ApplyAsync(c.Id, student)));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Equal(7, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        var seats = await Task.WhenAll(classes.Select(c => api.Client.GetClassAsync(c.Id)));
        Assert.Equal(1, seats.Sum(s => s.HeldSeats));
    }

    [Fact]
    public async Task Simultaneous_confirmations_of_one_hold_count_the_seat_once()
    {
        var created = await api.CreateClassAsync(totalSeats: 5);
        var student = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(created.Id, student);

        var responses = await Task.WhenAll(Enumerable.Range(0, 25)
            .Select(_ => api.Client.ConfirmAsync(hold.HoldId, student)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var seats = await api.Client.GetClassAsync(created.Id);
        Assert.Equal(1, seats.ConfirmedSeats);
        Assert.Equal(0, seats.HeldSeats);
        Assert.Equal(4, seats.AvailableSeats);
    }
}
