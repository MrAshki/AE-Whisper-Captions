# AE Subtitle AI Local

After Effects 2025 local speech-to-subtitle CEP extension.

AE Subtitle AI Local is a local-first subtitle workflow panel for Adobe After Effects 2025. It can transcribe local audio/video, edit subtitles in a table, import/export SRT files, read existing AE text layers, and create styled subtitle text layers in AE.

No OpenAI, DeepSeek, or cloud API key is required.

## Features

- Local speech transcription with `faster-whisper`
- Optional `whisper.cpp` backend
- Optional vocal separation with `demucs`
- Local subtitle cleanup and segmentation
- Optional offline translation with Argos Translate
- Import external `.srt` files, including bilingual subtitles
- Read existing text layers from the active AE composition
- Visual subtitle table editor
- Batch edit, find/replace, merge, split
- Import subtitles into AE as multi-layer or single-layer text
- Configure font, size, fill, stroke, shadow, and position
- Export source, translated, or bilingual SRT files

## Compatibility

- Adobe After Effects 2025
- AEFT 25.x
- CEP 12
- Windows tested

## Installation

1. Download the release zip.
2. Unzip it.
3. Open the extracted `AESpeechSubtitleAI` folder.
4. Double-click `INSTALL.cmd`.
5. Wait until you see `SUCCESS: Installed.`
6. Restart After Effects 2025.
7. Open `Window > Extensions > AE Subtitle AI Local`.

Do not run the installer directly from inside the zip preview window. Unzip first.

## Speech Recognition Setup

The plugin UI can open without Python dependencies, but local transcription requires `faster-whisper`.

Easy setup:

1. Double-click `INSTALL_SPEECH_DEPS.cmd`.
2. Wait until you see `SUCCESS: faster-whisper is installed.`
3. Restart After Effects.
4. Click `本地转录` in the panel.

Manual setup:

```bat
python -m pip install --user --upgrade faster-whisper
```

Optional vocal separation:

```bat
python -m pip install --user --upgrade demucs
```

Optional offline translation:

```bat
python -m pip install --user --upgrade argostranslate
```

The first transcription may download the selected Whisper model. After the model is available locally, transcription runs on your machine.

## Basic Usage

1. Open the AE panel.
2. Select an audio or video file.
3. Use `faster-whisper` as the backend.
4. Set the model, for example `large-v3-turbo`, `medium`, or `small`.
5. Click `本地转录`.
6. Edit the generated subtitles in the table.
7. Click `一键导入AE` to create subtitle layers in the active composition.

If the file picker does not fill a full path, paste the audio/video path into `媒体路径`.

## Project Structure

```text
AESpeechSubtitleAI/
  CSXS/                  CEP manifest
  backend/               Python helpers
  js/                    Panel JavaScript
  jsx/                   After Effects ExtendScript bridge
  index.html             Panel UI
  styles.css             Panel styles
  INSTALL.cmd            CEP installer
  INSTALL_SPEECH_DEPS.cmd
```

## What Is Not Included

This repository does not include:

- Whisper model files
- Audio or video examples
- Python virtual environments
- API keys
- User cache files

## License

MIT License.
