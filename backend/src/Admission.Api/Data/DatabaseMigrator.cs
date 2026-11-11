using Microsoft.EntityFrameworkCore;

namespace Admission.Api.Data;

public static class DatabaseMigrator
{
    // Any constant works; it only has to be the same for every API instance.
    private const long MigrationLockKey = 0x5C_400_2026;

    /// <summary>
    /// Applies EF Core migrations. Retries while PostgreSQL is starting, and holds a
    /// PostgreSQL advisory lock so several API instances can start at the same time.
    /// </summary>
    public static async Task MigrateAsync(IServiceProvider services, CancellationToken ct = default)
    {
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DatabaseMigrator));
        const int maxAttempts = 30;

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var scope = services.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AdmissionDbContext>();
                await db.Database.OpenConnectionAsync(ct);
                try
                {
                    await db.Database.ExecuteSqlRawAsync($"SELECT pg_advisory_lock({MigrationLockKey})", ct);
                    await db.Database.MigrateAsync(ct);
                    await db.Database.ExecuteSqlRawAsync($"SELECT pg_advisory_unlock({MigrationLockKey})", ct);
                }
                finally
                {
                    await db.Database.CloseConnectionAsync();
                }

                logger.LogInformation("Database is up to date");
                return;
            }
            catch (Exception error) when (attempt < maxAttempts && error is not OperationCanceledException)
            {
                logger.LogWarning("Database not ready (attempt {Attempt}/{Max}): {Message}",
                    attempt, maxAttempts, error.Message);
                await Task.Delay(TimeSpan.FromSeconds(2), ct);
            }
        }
    }
}
