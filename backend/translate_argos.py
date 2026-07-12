import argparse
import json
import sys
import traceback
from pathlib import Path


def has_cjk(text):
    return any("\u3400" <= ch <= "\u9fff" for ch in text)


def normalize_lang(code, texts):
    code = (code or "auto").strip().lower()
    mapping = {
        "简体中文": "zh",
        "中文": "zh",
        "中国語": "zh",
        "english": "en",
        "英语": "en",
        "日语": "ja",
        "日本語": "ja",
        "韩语": "ko",
        "한국어": "ko",
    }
    code = mapping.get(code, code)
    if code != "auto":
        return code
    sample = " ".join(texts[:8])
    return "zh" if has_cjk(sample) else "en"


def write_payload(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    try:
        from argostranslate import translate

        payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
        texts = payload.get("texts") or []
        source_code = normalize_lang(payload.get("source"), texts)
        target_code = normalize_lang(payload.get("target") or "zh", texts)

        installed = translate.get_installed_languages()
        source_lang = next((lang for lang in installed if lang.code == source_code), None)
        target_lang = next((lang for lang in installed if lang.code == target_code), None)
        if not source_lang or not target_lang:
            raise RuntimeError(f"Argos Translate 未安装 {source_code}->{target_code} 离线语言包")

        translation = source_lang.get_translation(target_lang)
        translations = [translation.translate(text or "") for text in texts]
        write_payload(
            args.output,
            {
                "ok": True,
                "source": source_code,
                "target": target_code,
                "translations": translations,
            },
        )
        print(f"Translated {len(translations)} lines: {source_code}->{target_code}", flush=True)
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
