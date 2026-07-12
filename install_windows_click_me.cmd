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
    echo Could not find CSXS\manifest.xml.
    echo.
    echo Please unzip the package first, then run this installer
    echo from inside the extracted AESpeechSubtitleAI folder.
    echo.
    pause
    exit /b 1
)

echo Target folder:
echo %TARGET%
echo.

if not exist "%EXTROOT%" mkdir "%EXTROOT%"
if not exist "%TARGET%" mkdir "%TARGET%"

echo Copying files...
xcopy "%SOURCE%*" "%TARGET%\" /E /I /Y /Q >nul
if errorlevel 1 (
    echo.
    echo Copy failed. Please close After Effects and run this file again.
    echo.
    pause
    exit /b 1
)

echo Enabling unsigned CEP extensions for AE 2025...
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
if errorlevel 1 (
    echo.
    echo Registry update failed. Right-click this file and choose Run as administrator.
    echo.
    pause
    exit /b 1
)

echo.
echo Installed successfully.
echo.
echo Restart After Effects 2025, then open:
echo Window ^> Extensions ^> AE Subtitle AI Local
echo.
echo If it is still missing, send a screenshot of this window.
echo.
pause
