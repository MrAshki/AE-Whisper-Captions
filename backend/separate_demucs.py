import argparse
import json
import subprocess
import sys
import traceback
from pathlib import Path


def write_payload(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def find_vocals(outdir):
    candidates = sorted(Path(outdir).rglob("vocals.wav"))
    if candidates:
        return str(candidates[0])
    candidates = sorted(Path(outdir).rglob("*vocals*.wav"))
    if candidates:
        return str(candidates[0])
    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--outdir", required=True)
    parser.add_argument("--model", default="htdemucs")
    args = parser.parse_args()

    try:
        command = [
            sys.executable,
            "-m",
            "demucs",
            "--two-stems",
            "vocals",
            "-n",
            args.model,
            "-o",
            args.outdir,
            args.input,
        ]
        subprocess.run(command, check=True)
        vocals = find_vocals(args.outdir)
        if not vocals:
            raise RuntimeError("Demucs 已运行，但没有找到 vocals.wav")
        write_payload(args.output, {"ok": True, "vocals": vocals})
        print(f"Vocals: {vocals}", flush=True)
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
