using System.Net.Http.Json;
using System.Security.Cryptography;
using Admission.Api.Contracts;

namespace Admission.Tests.Infrastructure;

public static class HttpExtensions
{
    /// <summary>A random, valid 17-digit Birth Registration Number.</summary>
    public static string NewStudentId() =>
        "20" + RandomNumberGenerator.GetInt32(0, 1_000_000_000).ToString("D9")
             + RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    public static Task<HttpResponseMessage> ApplyAsync(this HttpClient client, Guid classId, string studentId) =>
        client.SendAsync(Request(HttpMethod.Post, $"/classes/{classId}/holds", studentId));

    public static Task<HttpResponseMessage> JoinWaitlistAsync(this HttpClient client, Guid classId, string studentId) =>
        client.SendAsync(Request(HttpMethod.Post, $"/classes/{classId}/waitlist", studentId));

    public static async Task<HoldCreatedResponse> JoinWaitlistOkAsync(this HttpClient client, Guid classId, string studentId)
    {
        var response = await client.JoinWaitlistAsync(classId, studentId);
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HoldCreatedResponse>())!;
    }

    /// <summary>The student's application with this id, as /me/holds reports it.</summary>
    public static async Task<StudentHoldResponse> MyHoldAsync(this HttpClient client, string studentId, Guid holdId)
    {
        var holds = await (await client.MyHoldsAsync(studentId)).Content.ReadFromJsonAsync<List<StudentHoldResponse>>();
        return holds!.Single(h => h.HoldId == holdId);
    }

    public static Task<HttpResponseMessage> ConfirmAsync(
        this HttpClient client,
        Guid holdId,
        string studentId,
        string? studentName = "Test Student",
        int? age = 10)
    {
        var content = studentName != null || age != null
            ? JsonContent.Create(new ConfirmHoldRequest(studentName, age))
            : null;
        return client.SendAsync(Request(HttpMethod.Post, $"/holds/{holdId}/confirm", studentId, content));
    }

    public static Task<HttpResponseMessage> CancelAsync(this HttpClient client, Guid holdId, string studentId) =>
        client.SendAsync(Request(HttpMethod.Delete, $"/holds/{holdId}", studentId));

    public static Task<HttpResponseMessage> MyHoldsAsync(this HttpClient client, string studentId) =>
        client.SendAsync(Request(HttpMethod.Get, "/me/holds", studentId));

    public static async Task<HoldCreatedResponse> ApplyOkAsync(this HttpClient client, Guid classId, string studentId)
    {
        var response = await client.ApplyAsync(classId, studentId);
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HoldCreatedResponse>())!;
    }

    public static async Task<ClassResponse> GetClassAsync(this HttpClient client, Guid classId) =>
        (await client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}"))!;

    public static async Task<string> ErrorCodeAsync(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ErrorResponse>())!.Error;

    private static HttpRequestMessage Request(HttpMethod method, string path, string studentId, HttpContent? content = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("X-Student-Id", studentId);
        if (content != null) request.Content = content;
        return request;
    }
}
