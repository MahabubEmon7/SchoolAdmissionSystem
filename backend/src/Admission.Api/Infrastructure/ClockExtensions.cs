namespace Admission.Api.Infrastructure;

public static class ClockExtensions
{
    /// <summary>Current UTC time at PostgreSQL's microsecond precision, so stored and returned values match.</summary>
    public static DateTimeOffset UtcNowForDb(this TimeProvider clock)
    {
        var ticks = clock.GetUtcNow().UtcTicks;
        return new DateTimeOffset(ticks - ticks % 10, TimeSpan.Zero);
    }
}
