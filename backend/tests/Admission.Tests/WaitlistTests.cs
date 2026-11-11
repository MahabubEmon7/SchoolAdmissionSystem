using System.Net;
using System.Net.Http.Json;
using Admission.Tests.Infrastructure;

namespace Admission.Tests;

/// <summary>Own fixture: these tests move the fake clock.</summary>
public sealed class WaitlistTests(ApiFixture api) : IClassFixture<ApiFixture>
{
    private static string Student() => HttpExtensions.NewStudentId();

    [Fact]
    public async Task Students_queue_when_every_seat_is_held_and_get_the_seat_when_one_is_cancelled()
    {
        var created = await api.CreateClassAsync(totalSeats: 1);
        var (holder, first, second) = (Student(), Student(), Student());
        var held = await api.Client.ApplyOkAsync(created.Id, holder);

        var full = await api.Client.ApplyAsync(created.Id, Student());
        Assert.Equal("SEATS_FULL", await full.ErrorCodeAsync());

        var a = await api.Client.JoinWaitlistOkAsync(created.Id, first);
        var b = await api.Client.JoinWaitlistOkAsync(created.Id, second);
        Assert.Equal(("WAITLISTED", 1, (DateTime?)null), (a.Status, a.WaitlistPosition, a.ExpiresAt));
        Assert.Equal(2, b.WaitlistPosition);
        Assert.Equal(2, (await api.Client.GetClassAsync(created.Id)).WaitlistCount);

        await api.Client.CancelAsync(held.HoldId, holder);

        var promoted = await api.Client.MyHoldAsync(first, a.HoldId);
        Assert.Equal("HELD", promoted.Status);
        Assert.Equal(api.Clock.GetUtcNow().AddSeconds(ApiFixture.HoldSeconds).UtcDateTime,
            promoted.ExpiresAt!.Value, TimeSpan.FromSeconds(1)); // a full, fresh payment window
        Assert.Equal(1, (await api.Client.MyHoldAsync(second, b.HoldId)).WaitlistPosition);
        var seats = await api.Client.GetClassAsync(created.Id);
        Assert.Equal((1, 0, 1), (seats.HeldSeats, seats.AvailableSeats, seats.WaitlistCount));
    }

    [Fact]
    public async Task An_expired_hold_goes_to_the_waitlist_before_any_newcomer()
    {
        var created = await api.CreateClassAsync(totalSeats: 1);
        var (holder, waiting) = (Student(), Student());
        await api.Client.ApplyOkAsync(created.Id, holder);
        var entry = await api.Client.JoinWaitlistOkAsync(created.Id, waiting);

        api.Clock.Advance(TimeSpan.FromSeconds(ApiFixture.HoldSeconds + 1));

        var newcomer = await api.Client.ApplyAsync(created.Id, Student());
        Assert.Equal(HttpStatusCode.Conflict, newcomer.StatusCode);
        Assert.Equal("HELD", (await api.Client.MyHoldAsync(waiting, entry.HoldId)).Status);
        Assert.Equal(HttpStatusCode.OK, (await api.Client.ConfirmAsync(entry.HoldId, waiting)).StatusCode);
    }

    [Fact]
    public async Task The_background_worker_promotes_the_waitlist_without_any_request()
    {
        var created = await api.CreateClassAsync(totalSeats: 1);
        var waiting = Student();
        await api.Client.ApplyOkAsync(created.Id, Student());
        var entry = await api.Client.JoinWaitlistOkAsync(created.Id, waiting);

        api.Clock.Advance(TimeSpan.FromSeconds(ApiFixture.HoldSeconds + 1));

        var deadline = DateTime.UtcNow.AddSeconds(10);
        string status;
        do
        {
            await Task.Delay(100);
            api.Clock.Advance(TimeSpan.FromMilliseconds(500)); // wakes the worker's fake-clock delay
            status = (await api.Client.MyHoldAsync(waiting, entry.HoldId)).Status;
        } while (status != "HELD" && DateTime.UtcNow < deadline);

        Assert.Equal("HELD", status);
        Assert.Equal(0, (await api.Client.GetClassAsync(created.Id)).WaitlistCount);
    }

    [Fact]
    public async Task Joining_the_waitlist_holds_a_seat_directly_when_one_is_free()
    {
        var created = await api.CreateClassAsync(totalSeats: 2);

        var entry = await api.Client.JoinWaitlistOkAsync(created.Id, Student());

        Assert.Equal("HELD", entry.Status);
        Assert.NotNull(entry.ExpiresAt);
        Assert.Null(entry.WaitlistPosition);
    }

    [Fact]
    public async Task There_is_no_waitlist_once_every_seat_is_confirmed()
    {
        var created = await api.CreateClassAsync(totalSeats: 1);
        var payer = Student();
        var hold = await api.Client.ApplyOkAsync(created.Id, payer);
        await api.Client.ConfirmAsync(hold.HoldId, payer);

        var response = await api.Client.JoinWaitlistAsync(created.Id, Student());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("CLASS_FULL", await response.ErrorCodeAsync());
    }

    [Fact]
    public async Task A_waitlisted_student_cannot_pay_but_can_leave_and_apply_elsewhere()
    {
        var created = await api.CreateClassAsync(totalSeats: 1);
        var other = await api.CreateClassAsync(totalSeats: 1);
        var waiting = Student();
        await api.Client.ApplyOkAsync(created.Id, Student());
        var entry = await api.Client.JoinWaitlistOkAsync(created.Id, waiting);

        var pay = await api.Client.ConfirmAsync(entry.HoldId, waiting);
        Assert.Equal("HOLD_WAITLISTED", await pay.ErrorCodeAsync());

        Assert.Equal(HttpStatusCode.NoContent, (await api.Client.CancelAsync(entry.HoldId, waiting)).StatusCode);
        Assert.Equal("CANCELLED", (await api.Client.MyHoldAsync(waiting, entry.HoldId)).Status);
        Assert.Equal(0, (await api.Client.GetClassAsync(created.Id)).WaitlistCount);
        await api.Client.ApplyOkAsync(other.Id, waiting);
    }

    [Fact]
    public async Task Freed_seats_never_overfill_the_class_when_many_holds_end_at_once()
    {
        var created = await api.CreateClassAsync(totalSeats: 5);
        var holders = Enumerable.Range(0, 5).Select(_ => Student()).ToArray();
        var holds = await Task.WhenAll(holders.Select(s => api.Client.ApplyOkAsync(created.Id, s)));
        var waiting = Enumerable.Range(0, 20).Select(_ => Student()).ToArray();
        foreach (var s in waiting) await api.Client.JoinWaitlistOkAsync(created.Id, s);

        await Task.WhenAll(holds.Select((h, i) => api.Client.CancelAsync(h.HoldId, holders[i])));

        var seats = await api.Client.GetClassAsync(created.Id);
        Assert.Equal((5, 0, 15), (seats.HeldSeats, seats.AvailableSeats, seats.WaitlistCount));
        var statuses = await Task.WhenAll(waiting.Select(async s =>
            (await (await api.Client.MyHoldsAsync(s)).Content
                .ReadFromJsonAsync<List<Admission.Api.Contracts.StudentHoldResponse>>())!.Single().Status));
        Assert.Equal(5, statuses.Count(s => s == "HELD"));
        Assert.All(statuses.Take(5), s => Assert.Equal("HELD", s)); // first come, first served
    }
}
