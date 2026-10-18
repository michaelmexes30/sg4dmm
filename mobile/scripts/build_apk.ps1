# SG4DMyanmar Automated APK Build Script (Windows PowerShell)
param (
    [string]$BuildType = "release" # debug or release
)

Write-Host "==========================================" -ForegroundColor Magenta
Write-Host " SG4DMyanmar Android APK Export Pipeline " -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta

$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$androidDir = Join-Path $rootDir "mobile\android"

if (-not (Test-Path $androidDir)) {
    Write-Error "Android project directory not found at $androidDir"
    exit 1
}

Push-Location $androidDir

try {
    Write-Host "`n[1/3] Checking Gradle and Android environment..." -ForegroundColor Cyan
    if ($env:ANDROID_HOME) {
        Write-Host "Found ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
    } else {
        Write-Host "Note: ANDROID_HOME environment variable is not explicitly set. Gradle will use system SDK if installed." -ForegroundColor Yellow
    }

    Write-Host "`n[2/3] Compiling and assembling $BuildType APK..." -ForegroundColor Cyan
    $gradleTask = if ($BuildType -eq "release") { "assembleRelease" } else { "assembleDebug" }
    
    # Run Gradle wrapper or system gradle
    if (Test-Path ".\gradlew.bat") {
        .\gradlew.bat $gradleTask
    } else {
        gradle $gradleTask
    }

    Write-Host "`n[3/3] Locating generated APK..." -ForegroundColor Cyan
    $apkPath = Join-Path $androidDir "app\build\outputs\apk\$BuildType"
    if (Test-Path $apkPath) {
        $apks = Get-ChildItem -Path $apkPath -Filter "*.apk"
        foreach ($apk in $apks) {
            Write-Host "SUCCESS: Exported APK -> $($apk.FullName)" -ForegroundColor Green
            Write-Host "Size: $([math]::Round($apk.Length / 1MB, 2)) MB" -ForegroundColor Green
        }
    } else {
        Write-Host "Build command completed. APK output directory: $apkPath" -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
