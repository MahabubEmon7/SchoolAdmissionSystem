# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
# Restore first so package downloads are cached between code changes.
COPY Admission.sln ./
COPY src/Admission.Api/Admission.Api.csproj src/Admission.Api/
COPY tests/Admission.Tests/Admission.Tests.csproj tests/Admission.Tests/
RUN dotnet restore Admission.sln
COPY . ./

# `docker compose --profile test run --rm backend-tests` runs the xUnit suite with this stage.
FROM build AS test
ENTRYPOINT ["dotnet", "test", "Admission.sln", "--no-restore", "--logger", "console;verbosity=normal"]

FROM build AS publish
RUN dotnet publish src/Admission.Api/Admission.Api.csproj -c Release --no-restore -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:8080 \
    ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "Admission.Api.dll"]
