@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   DISHA Field Tracker - Windows Debug APK Build Script
echo ========================================================
echo.

if not defined ANDROID_HOME (
    set "ANDROID_HOME=C:\Users\Moizd\AppData\Local\Android\Sdk"
)

echo Android SDK Home : %ANDROID_HOME%
echo Current Directory: %~dp0
cd /d "%~dp0"

echo.
echo Running: gradlew.bat assembleDebug
echo.

call gradlew.bat assembleDebug
set BUILD_STATUS=%ERRORLEVEL%

if %BUILD_STATUS% equ 0 (
    echo.
    echo ========================================================
    echo   BUILD SUCCESSFUL!
    echo ========================================================
    echo APK Location:
    set "APK_PATH=%~dp0app\build\outputs\apk\debug\app-debug.apk"
    if exist "!APK_PATH!" (
        echo   !APK_PATH!
        for %%I in ("!APK_PATH!") do echo File Size   : %%~zI bytes
    ) else (
        echo   app\build\outputs\apk\debug\app-debug.apk
    )
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo   BUILD FAILED (Error code: %BUILD_STATUS%)
    echo ========================================================
)

exit /b %BUILD_STATUS%
