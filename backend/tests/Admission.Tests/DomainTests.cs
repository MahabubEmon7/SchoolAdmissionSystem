using Admission.Api.Domain;

namespace Admission.Tests;

public sealed class DomainTests
{
    [Theory]
    [InlineData("20152691234567890", true)]
    [InlineData("00000000000000001", true)]
    [InlineData("2015269123456789", false)]
    [InlineData("201526912345678901", false)]
    [InlineData("2015269123456789O", false)]
    [InlineData("２０１５２６９１２３４５６７８９０", false)] // full-width digits
    [InlineData(null, false)]
    public void Student_id_must_be_17_ascii_digits(string? value, bool valid) =>
        Assert.Equal(valid, StudentId.IsValid(value));

    [Fact]
    public void Held_status_reads_as_expired_once_the_deadline_passes()
    {
        var deadline = new DateTimeOffset(2026, 11, 1, 4, 10, 0, TimeSpan.Zero);
        var hold = new Hold { StudentId = "20152691234567890", Status = HoldStatus.Held, ExpiresAt = deadline };

        Assert.Equal(HoldStatus.Held, hold.EffectiveStatus(deadline.AddTicks(-1)));
        Assert.Equal(HoldStatus.Expired, hold.EffectiveStatus(deadline));

        hold.Status = HoldStatus.Confirmed;
        Assert.Equal(HoldStatus.Confirmed, hold.EffectiveStatus(deadline.AddDays(1)));
    }

    [Theory]
    [InlineData("  class 6 - morning shift ", 6, ClassShift.Morning)]
    [InlineData("Class 12 Day", 12, ClassShift.Day)]
    [InlineData("CLASS 1 – Day Shift", 1, ClassShift.Day)]
    public void Class_names_are_read_as_grade_and_shift(string name, int grade, ClassShift shift)
    {
        Assert.True(SchoolClass.TryParseName(name, out var g, out var s));
        Assert.Equal((grade, shift), (g, s));
    }

    [Theory]
    [InlineData("Class 0")]
    [InlineData("Class 13")]
    [InlineData("Grade 6")]
    [InlineData("Class 6")]
    [InlineData("Class 6 - Night Shift")]
    [InlineData("")]
    public void Other_names_are_not_classes(string name) =>
        Assert.False(SchoolClass.TryParseName(name, out _, out _));

    [Fact]
    public void Display_names_are_canonical()
    {
        Assert.Equal("Class 6 - Day Shift", SchoolClass.DisplayName(6, ClassShift.Day));
        Assert.Equal("Class 6 - Morning Shift", SchoolClass.DisplayName(6, ClassShift.Morning));
    }
}
