using System.Text.Json;
using Admission.Api.Infrastructure;
using StackExchange.Redis;

namespace Admission.Api.Services;

/// <summary>
/// Short-lived read cache for seat counts. It is only an optimisation: seat limits are
/// enforced in PostgreSQL, so a missing or unavailable cache never affects correctness.
/// </summary>
public interface ISeatCache
{
    Task<T?> GetAsync<T>(string key) where T : class;
    Task SetAsync<T>(string key, T value) where T : class;
    Task InvalidateAsync(IEnumerable<Guid> classIds);
}

public static class SeatCacheKeys
{
    public const string AllClasses = "admissions:classes:all";
    public static string Class(Guid id) => $"admissions:classes:{id}";
}

public sealed class NoSeatCache : ISeatCache
{
    public Task<T?> GetAsync<T>(string key) where T : class => Task.FromResult<T?>(null);
    public Task SetAsync<T>(string key, T value) where T : class => Task.CompletedTask;
    public Task InvalidateAsync(IEnumerable<Guid> classIds) => Task.CompletedTask;
}

public sealed class RedisSeatCache : ISeatCache, IDisposable
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan BackOff = TimeSpan.FromSeconds(15);

    private readonly ConnectionMultiplexer _redis;
    private readonly TimeSpan _ttl;
    private readonly TimeProvider _clock;
    private readonly ILogger<RedisSeatCache> _logger;
    private long _skipUntilTicks;

    public RedisSeatCache(AdmissionOptions options, TimeProvider clock, ILogger<RedisSeatCache> logger)
    {
        var config = ConfigurationOptions.Parse(options.RedisConnectionString!);
        config.AbortOnConnectFail = false; // keep retrying in the background
        config.ConnectTimeout = 1000;
        config.SyncTimeout = 500;
        config.AsyncTimeout = 500;
        _redis = ConnectionMultiplexer.Connect(config);
        _ttl = TimeSpan.FromSeconds(options.CacheTtlSeconds);
        _clock = clock;
        _logger = logger;
    }

    public Task<T?> GetAsync<T>(string key) where T : class => Guard(async db =>
    {
        var value = await db.StringGetAsync(key);
        return value.HasValue ? JsonSerializer.Deserialize<T>(value.ToString(), Json) : null;
    }, default(T));

    public Task SetAsync<T>(string key, T value) where T : class => _ttl == TimeSpan.Zero
        ? Task.CompletedTask
        : Guard(async db => await db.StringSetAsync(key, JsonSerializer.Serialize(value, Json), _ttl), false);

    public Task InvalidateAsync(IEnumerable<Guid> classIds) => Guard(async db =>
    {
        var keys = classIds.Select(id => (RedisKey)SeatCacheKeys.Class(id))
            .Append(SeatCacheKeys.AllClasses)
            .ToArray();
        return await db.KeyDeleteAsync(keys);
    }, 0L, alwaysTry: true);

    /// <summary>Runs a Redis call; on failure logs once and skips Redis for a short back-off.</summary>
    private async Task<TResult> Guard<TResult>(Func<IDatabase, Task<TResult>> action, TResult fallback,
        bool alwaysTry = false)
    {
        // Invalidation is always attempted so a recovered Redis never serves stale counts for long.
        if (!alwaysTry && _clock.GetUtcNow().UtcTicks < Interlocked.Read(ref _skipUntilTicks)) return fallback;
        try
        {
            return await action(_redis.GetDatabase());
        }
        catch (Exception error) when (error is RedisException or TimeoutException)
        {
            var until = _clock.GetUtcNow().Add(BackOff).UtcTicks;
            if (Interlocked.Exchange(ref _skipUntilTicks, until) < _clock.GetUtcNow().UtcTicks)
                _logger.LogWarning("Redis unavailable, serving from PostgreSQL for {Seconds}s: {Message}",
                    BackOff.TotalSeconds, error.Message);
            return fallback;
        }
    }

    public void Dispose() => _redis.Dispose();
}
