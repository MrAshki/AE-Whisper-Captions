import argparse
import json
import sys
import traceback
from pathlib import Path


def write_payload(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="large-v3-turbo")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--compute-type", default="auto")
    parser.add_argument("--language", default=None)
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel

        model_name = args.model
        device = "auto" if args.device == "auto" else args.device
        compute_type = "default" if args.compute_type == "auto" else args.compute_type

        print(f"Loading faster-whisper model: {model_name}", flush=True)
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        segments, info = model.transcribe(
            args.input,
            beam_size=5,
            vad_filter=True,
            language=None if not args.language or args.language == "auto" else args.language,
        )

        captions = []
        for index, segment in enumerate(segments):
            text = (segment.text or "").strip()
            if not text:
                continue
            captions.append(
                {
                    "id": f"fw-{index + 1}",
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "text": text,
                    "translation": "",
                }
            )

        write_payload(
            args.output,
            {
                "ok": True,
                "language": getattr(info, "language", ""),
                "language_probability": float(getattr(info, "language_probability", 0) or 0),
                "captions": captions,
            },
        )
        print(f"Done: {len(captions)} segments", flush=True)
    except Exception as error:
        write_payload(
            args.output,
            {
                "ok": False,
                "error": str(error),
                "traceback": traceback.format_exc(),
            },
        )
        print(str(error), file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
