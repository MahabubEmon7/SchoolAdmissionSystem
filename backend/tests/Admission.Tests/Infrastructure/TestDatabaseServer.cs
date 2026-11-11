using Npgsql;
using Testcontainers.PostgreSql;

namespace Admission.Tests.Infrastructure;

/// <summary>
/// One PostgreSQL server for the whole test run. Uses TEST_DATABASE_CONNECTION_STRING when
/// set (e.g. inside Docker Compose); otherwise starts a throwaway container via Testcontainers.
/// Each fixture gets its own fresh database on that server.
/// </summary>
public static class TestDatabaseServer
{
    private static readonly Lazy<Task<string>> Server = new(StartAsync);

    public static async Task<string> CreateDatabaseAsync()
    {
        var server = new NpgsqlConnectionStringBuilder(await Server.Value);
        var name = $"admissions_test_{Guid.NewGuid():N}";

        await using (var connection = new NpgsqlConnection(server.ConnectionString))
        {
            await connection.OpenAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", connection);
            await create.ExecuteNonQueryAsync();
        }

        // Two API hosts share one database in the multi-instance test; keep both pools
        // well below PostgreSQL's default max_connections (100).
        server.Database = name;
        server.MaxPoolSize = 30;
        return server.ConnectionString;
    }

    /// <summary>Drops a database made by <see cref="CreateDatabaseAsync"/>.</summary>
    public static async Task DropDatabaseAsync(string connectionString)
    {
        var name = new NpgsqlConnectionStringBuilder(connectionString).Database;
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(await Server.Value);
        await connection.OpenAsync();
        await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", connection);
        await drop.ExecuteNonQueryAsync();
    }

    private static async Task<string> StartAsync()
    {
        var configured = Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION_STRING");
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        var container = new PostgreSqlBuilder().WithImage("postgres:16-alpine").Build();
        await container.StartAsync(); // Testcontainers removes it when the test run ends
        return container.GetConnectionString();
    }
}
