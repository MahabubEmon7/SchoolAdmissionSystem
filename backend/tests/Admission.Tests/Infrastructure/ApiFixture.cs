using System.Net.Http.Json;
using Admission.Api.Contracts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;

namespace Admission.Tests.Infrastructure;

/// <summary>A real API host on a fresh PostgreSQL database, with a controllable clock.</summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public const int HoldSeconds = 600;

    private readonly List<WebApplicationFactory<Program>> _hosts = [];
    private string _connectionString = "";

    public FakeTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow);
    public HttpClient Client { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        _connectionString = await TestDatabaseServer.CreateDatabaseAsync();
        Client = StartHost();
    }

    /// <summary>
    /// Starts another API process-equivalent (own DI container, connection pool and worker)
    /// on the same database, like a second container behind a load balancer.
    /// </summary>
    public HttpClient StartHost()
    {
        var host = new WebApplicationFactory<Program>().WithWebHostBuilder(web =>
        {
            web.UseSetting("DATABASE_CONNECTION_STRING", _connectionString);
            web.UseSetting("REDIS_CONNECTION_STRING", "");
            web.UseSetting("HOLD_DURATION_SECONDS", HoldSeconds.ToString());
            web.ConfigureLogging(logging => logging.SetMinimumLevel(LogLevel.Warning));
            web.ConfigureServices(services => services.Replace(ServiceDescriptor.Singleton<TimeProvider>(Clock)));
        });
        _hosts.Add(host);
        return host.CreateClient();
    }

    private static readonly string[] ShiftOrder = ["DAY", "MORNING"];
    private int _nextClass = -1;

    /// <summary>
    /// Creates a class with the next unused grade/shift pair (Class 1 - Day Shift, Class 2 - Day Shift, ...).
    /// Morning shifts come last so tests can use names like "Class 6 - Morning Shift" themselves.
    /// </summary>
    public async Task<ClassCreatedResponse> CreateClassAsync(int totalSeats)
    {
        var i = Interlocked.Increment(ref _nextClass);
        var response = await Client.PostAsJsonAsync("/classes",
            new { grade = i % 12 + 1, shift = ShiftOrder[i / 12 % 2], totalSeats });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ClassCreatedResponse>())!;
    }

    public async Task DisposeAsync()
    {
        foreach (var host in _hosts) await host.DisposeAsync();
        await TestDatabaseServer.DropDatabaseAsync(_connectionString);
    }
}
