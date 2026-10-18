@echo off
REM ========================================================
REM SG4DMyanmar Android APK Build Script
REM ========================================================
echo [1/3] Checking Android Project Configuration...
cd /d "%~dp0"

echo [2/3] Preparing Gradle Build Environment...
if exist gradlew.bat (
    echo Found Gradle Wrapper. Building Debug APK...
    call gradlew.bat assembleDebug
) else (
    echo Gradle wrapper not initialized in this folder.
    echo To build using Android Studio:
    echo 1. Open Android Studio
    echo 2. Select 'Open Project' -> Choose 'D:\SG4DMyanmar\mobile\android'
    echo 3. Click 'Build' -> 'Build Bundle(s) / APK(s)' -> 'Build APK(s)'
)

echo [3/3] Done.
pause
