# Contributing

Thanks for considering a contribution.

## Development Notes

This is an Adobe CEP extension for After Effects 2025.

Useful folders:

- `CSXS/manifest.xml`: CEP extension manifest
- `index.html`: panel UI
- `js/`: panel logic
- `jsx/host.jsx`: After Effects scripting bridge
- `backend/`: Python helper scripts

## Local Checks

Run JavaScript syntax checks:

```bat
node --check js/app.js
node --check js/srt.js
node --check js/localOptimizer.js
node --check js/localServices.js
node --check js/aeBridge.js
```

Run Python syntax checks:

```bat
python -m py_compile backend\transcribe_faster_whisper.py backend\separate_demucs.py backend\translate_argos.py
```

## Pull Requests

Please keep changes focused and describe:

- What changed
- How it was tested
- Which After Effects version was used
