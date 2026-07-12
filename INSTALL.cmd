@echo off
title AE Subtitle AI Local Installer
setlocal

set "SOURCE=%~dp0"
set "EXTROOT=%APPDATA%\Adobe\CEP\extensions"
set "TARGET=%EXTROOT%\AESpeechSubtitleAI"

echo.
echo ===============================
echo   AE Subtitle AI Local Installer
echo ===============================
echo.
echo Source folder:
echo %SOURCE%
echo.

if not exist "%SOURCE%CSXS\manifest.xml" (
    echo ERROR: Could not find CSXS\manifest.xml.
    echo.
    echo Please unzip the package first.
    echo Then open the extracted AESpeechSubtitleAI folder
    echo and double-click INSTALL.cmd from there.
    echo.
    pause
    exit /b 1
)

echo Target folder:
echo %TARGET%
echo.

if not exist "%EXTROOT%" mkdir "%EXTROOT%"
if not exist "%TARGET%" mkdir "%TARGET%"

echo Copying extension files...
xcopy "%SOURCE%*" "%TARGET%\" /E /I /Y /Q >nul
if errorlevel 1 (
    echo.
    echo ERROR: Copy failed.
    echo Close After Effects and run INSTALL.cmd again.
    echo.
    pause
    exit /b 1
)

echo Enabling unsigned CEP extensions for AE 2025...
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
if errorlevel 1 (
    echo.
    echo ERROR: Registry update failed.
    echo Right-click INSTALL.cmd and choose Run as administrator.
    echo.
    pause
    exit /b 1
)

echo.
echo SUCCESS: Installed.
echo.
echo Restart After Effects 2025, then open:
echo Window ^> Extensions ^> AE Subtitle AI Local
echo.
echo Installed folder:
echo %TARGET%
echo.
pause
