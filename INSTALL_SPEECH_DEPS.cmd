@echo off
title Install speech recognition dependencies
setlocal

echo.
echo =========================================
echo   Install speech recognition dependencies
echo =========================================
echo.
echo This installs faster-whisper for the Python used by the plugin.
echo Internet is required for this step.
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python was not found.
    echo.
    echo Please install Python 3.10 or newer first, then run this file again.
    echo Download: https://www.python.org/downloads/
    echo Important: tick "Add python.exe to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo Python:
python --version
echo.

echo Upgrading pip...
python -m pip install --upgrade pip
if errorlevel 1 (
    echo.
    echo ERROR: pip upgrade failed.
    echo.
    pause
    exit /b 1
)

echo.
echo Installing faster-whisper...
python -m pip install --user --upgrade faster-whisper
if errorlevel 1 (
    echo.
    echo ERROR: faster-whisper installation failed.
    echo Check your internet connection, then run this file again.
    echo.
    pause
    exit /b 1
)

echo.
echo SUCCESS: faster-whisper is installed.
echo.
echo Restart After Effects, then click "本地转录" again.
echo.
echo Note: the first transcription may download the model.
echo.
pause
