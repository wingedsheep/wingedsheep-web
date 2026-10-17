"""Tine at her counter in the bookshop behind the page (src/island/lowwater/shop.ts): her lines
(src/island/lowwater/tine.json) recorded with ElevenLabs, levelled with ffmpeg into
public/audio/lowwater/tine/, and listed in src/island/lowwater/tine-tape.json for sound.ts.

Each clip is named after its line's place and a hash of its words and the voice, so an edited
line is recorded again and nothing else is (the old take is left for `git clean`).

    python3 tools/lowwater/tine.py            # record what's missing
    python3 tools/lowwater/tine.py --relevel  # level the recorded lines again (from raw/, no credits)
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
LINES = ROOT / "src" / "island" / "lowwater" / "tine.json"
TAPE = ROOT / "src" / "island" / "lowwater" / "tine-tape.json"
RAW = ROOT / "tools" / "sounds" / "raw" / "tine"
OUT = ROOT / "public" / "audio" / "lowwater" / "tine"

VOICE = "tfweP7lGJyLeNV9dH1Rm"  # Marianne, a senior Dutch voice from the ElevenLabs library, speaking English: low and level
MODEL = "eleven_multilingual_v2"
SETTINGS = {"stability": 0.55, "similarity_boost": 0.8, "style": 0.15}
LUFS = -20


def key() -> str:
    m = re.search(r"apiKey:\s*['\"]?([^'\"\s]+)", (ROOT / "config.yaml").read_text())
    if not m:
        sys.exit("No elevenlabs.apiKey in config.yaml")
    return m.group(1)


def lines():
    """(id, text) for every line: first.<moment>, then again.<n>."""
    t = json.loads(LINES.read_text())
    for moment, text in t["first"].items():
        yield f"first.{moment}", text
    for i, text in enumerate(t["again"]):
        yield f"again.{i}", text


def name(ident: str, text: str) -> str:
    h = hashlib.sha1(f"{VOICE}|{MODEL}|{text}".encode()).hexdigest()[:8]
    return f"{ident.replace('.', '-')}-{h}.mp3"


def record(text: str, raw: Path, out: Path):
    if not raw.exists():
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
                                     headers={"xi-api-key": key(), "content-type": "application/json"},
                                     data=json.dumps({"text": text, "model_id": MODEL, "language_code": "en", "voice_settings": SETTINGS}).encode())
        with urllib.request.urlopen(req, timeout=90) as r:
            raw.write_bytes(r.read())
    # mono, the silence trimmed off both ends, levelled for a voice across a small shop
    trim = "silenceremove=start_periods=1:start_threshold=-50dB"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-ac", "1",
                    "-af", f"{trim},areverse,{trim},areverse,loudnorm=I={LUFS}:TP=-2:LRA=11",
                    "-ar", "44100", "-b:a", "56k", str(out)], check=True)


def main(args: list[str]):
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    tape = {}
    for ident, text in lines():
        f = name(ident, text)
        if not (OUT / f).exists() or "--relevel" in args:
            record(text, RAW / f, OUT / f)
            print(f"{f}  {text[:70]}")
        tape[ident] = f
    TAPE.write_text(json.dumps(tape, indent=1) + "\n")
    print(f"On tape: {len(tape)} lines ({TAPE.relative_to(ROOT)})")


if __name__ == "__main__":
    main(sys.argv[1:])
