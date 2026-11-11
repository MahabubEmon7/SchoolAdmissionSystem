using System.Net;
using System.Net.Http.Json;
using Admission.Api.Contracts;
using Admission.Tests.Infrastructure;

namespace Admission.Tests;

/// <summary>Uses its own fixture so moving the fake clock cannot affect other tests.</summary>
public sealed class HoldExpiryTests(ApiFixture api) : IClassFixture<ApiFixture>
{
    [Fact]
    public async Task An_unpaid_hold_expires_on_its_own_and_frees_the_seat()
    {
        var created = await api.CreateClassAsync(totalSeats: 1);
        var student = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(created.Id, student);
        Assert.Equal(api.Clock.GetUtcNow().AddSeconds(ApiFixture.HoldSeconds).UtcDateTime,
            hold.ExpiresAt!.Value, TimeSpan.FromSeconds(1));

        api.Clock.Advance(TimeSpan.FromSeconds(ApiFixture.HoldSeconds + 1));

        // No API call is needed: reads already see the hold as expired.
        var status = await api.Client.GetFromJsonAsync<HoldResponse>($"/holds/{hold.HoldId}");
        Assert.Equal("EXPIRED", status!.Status);
        var seats = await api.Client.GetClassAsync(created.Id);
        Assert.Equal((0, 1), (seats.HeldSeats, seats.AvailableSeats));

        var late = await api.Client.ConfirmAsync(hold.HoldId, student);
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        Assert.Equal("HOLD_EXPIRED", await late.ErrorCodeAsync());
        Assert.Equal(0, (await api.Client.GetClassAsync(created.Id)).ConfirmedSeats);

        // The freed seat goes to the next applicant.
        await api.Client.ApplyOkAsync(created.Id, HttpExtensions.NewStudentId());
    }

    [Fact]
    public async Task The_background_worker_persists_the_expired_status()
    {
        var created = await api.CreateClassAsync(totalSeats: 2);
        var student = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(created.Id, student);

        api.Clock.Advance(TimeSpan.FromSeconds(ApiFixture.HoldSeconds + 5));

        // The worker sleeps on the fake clock; advancing it wakes the sweep.
        var deadline = DateTime.UtcNow.AddSeconds(10);
        List<StudentHoldResponse>? holds;
        do
        {
            await Task.Delay(100);
            api.Clock.Advance(TimeSpan.FromSeconds(1));
            holds = await (await api.Client.MyHoldsAsync(student)).Content
                .ReadFromJsonAsync<List<StudentHoldResponse>>();
        } while (holds!.Single().Status != "EXPIRED" && DateTime.UtcNow < deadline);

        Assert.Equal("EXPIRED", holds!.Single(h => h.HoldId == hold.HoldId).Status);

        // The student's old hold no longer blocks a new application.
        await api.Client.ApplyOkAsync(created.Id, student);
    }

    [Fact]
    public async Task A_hold_paid_before_the_deadline_stays_confirmed_after_it()
    {
        var created = await api.CreateClassAsync(totalSeats: 1);
        var student = HttpExtensions.NewStudentId();
        var hold = await api.Client.ApplyOkAsync(created.Id, student);

        api.Clock.Advance(TimeSpan.FromSeconds(ApiFixture.HoldSeconds - 1));
        Assert.Equal(HttpStatusCode.OK, (await api.Client.ConfirmAsync(hold.HoldId, student)).StatusCode);
        api.Clock.Advance(TimeSpan.FromHours(1));

        var status = await api.Client.GetFromJsonAsync<HoldResponse>($"/holds/{hold.HoldId}");
        Assert.Equal("CONFIRMED", status!.Status);
        Assert.Equal(1, (await api.Client.GetClassAsync(created.Id)).ConfirmedSeats);
    }
}
