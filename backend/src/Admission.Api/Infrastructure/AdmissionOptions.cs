namespace Admission.Api.Infrastructure;

/// <summary>Settings read from environment variables (see README).</summary>
public sealed class AdmissionOptions
{
    public string DatabaseConnectionString { get; set; } = "";
    public string? RedisConnectionString { get; set; }
    public int HoldDurationSeconds { get; set; } = 600;
    public int ExpirySweepSeconds { get; set; } = 1;
    public int CacheTtlSeconds { get; set; } = 2;
    public string[] CorsOrigins { get; set; } = ["*"];

    public static AdmissionOptions FromConfiguration(IConfiguration config)
    {
        var options = new AdmissionOptions
        {
            DatabaseConnectionString = config["DATABASE_CONNECTION_STRING"]
                ?? config.GetConnectionString("Postgres")
                ?? "",
            RedisConnectionString = config["REDIS_CONNECTION_STRING"],
            HoldDurationSeconds = config.GetValue("HOLD_DURATION_SECONDS", 600),
            ExpirySweepSeconds = config.GetValue("EXPIRY_SWEEP_SECONDS", 1),
            CacheTtlSeconds = config.GetValue("CACHE_TTL_SECONDS", 2),
            CorsOrigins = (config["CORS_ORIGINS"] ?? "*")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
        };
        options.Validate();
        return options;
    }

    private void Validate()
    {
        if (string.IsNullOrWhiteSpace(DatabaseConnectionString))
            throw new InvalidOperationException("Set DATABASE_CONNECTION_STRING.");
        if (HoldDurationSeconds < 1)
            throw new InvalidOperationException("HOLD_DURATION_SECONDS must be a positive number.");
        if (ExpirySweepSeconds < 1)
            throw new InvalidOperationException("EXPIRY_SWEEP_SECONDS must be a positive number.");
        if (CacheTtlSeconds < 0)
            throw new InvalidOperationException("CACHE_TTL_SECONDS cannot be negative.");
    }
}
