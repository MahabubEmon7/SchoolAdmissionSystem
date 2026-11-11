using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Admission.Api.Services;

/// <summary>
/// Every few seconds: stores HELD → EXPIRED for overdue holds, then hands freed seats to the
/// next waitlisted students. Reads already treat overdue holds as expired, so the sweep only
/// has to keep stored data tidy and move the waitlist. Safe to run in every API instance.
/// </summary>
public sealed class HoldExpiryWorker(
    IServiceScopeFactory scopes,
    AdmissionOptions options,
    TimeProvider clock,
    ISeatCache cache,
    ILogger<HoldExpiryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(options.ExpirySweepSeconds);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception error)
            {
                logger.LogWarning(error, "Hold expiry sweep failed; the next sweep will retry");
            }

            try
            {
                await Task.Delay(interval, clock, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    public async Task SweepAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AdmissionDbContext>();
        var ledger = scope.ServiceProvider.GetRequiredService<SeatLedger>();
        var now = clock.UtcNowForDb();

        var expiredIn = await db.Database.SqlQuery<Guid>($"""
            UPDATE holds SET status = 'EXPIRED'
            WHERE status = 'HELD' AND expires_at <= {now}
            RETURNING class_id AS "Value"
            """).ToListAsync(ct);
        if (expiredIn.Count > 0) logger.LogInformation("Expired {Count} unpaid seat hold(s)", expiredIn.Count);

        var changed = new HashSet<Guid>(expiredIn);
        var waitingIn = await db.Holds
            .Where(h => h.Status == HoldStatus.Waitlisted)
            .Select(h => h.ClassId)
            .Distinct()
            .ToListAsync(ct);

        foreach (var classId in waitingIn)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var schoolClass = await ledger.LockClassAsync(classId, ct);
            if (schoolClass is null) continue;
            var promoted = await ledger.PromoteWaitlistAsync(schoolClass, clock.UtcNowForDb(), ct);
            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear();

            if (promoted == 0) continue;
            changed.Add(classId);
            logger.LogInformation("Gave {Count} freed seat(s) in {Class} to waitlisted students",
                promoted, schoolClass.Name);
        }

        if (changed.Count > 0) await cache.InvalidateAsync(changed);
    }
}
