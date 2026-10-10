"""Kees on the air: the Radio Alles DJ's lines (lines/*.json, written to DJ.md) recorded with
ElevenLabs, levelled with ffmpeg into public/audio/dj/, and listed in src/data/dj.json for
src/island/radio.ts.

Each clip is named after a hash of its words and the voice, so an edited line is recorded again
and nothing else is. The chatter goes first, then the intros in the playlist's order. Recording
costs credits, and the plan's are few, so it stops while there are still RESERVE left (or after
--max clips); run it again next month and it carries on where it stopped. The DJ only
introduces songs whose intro is recorded, and talks in between either way.

    just dj              # record what's missing, as far as the credits go
    just dj --max 20     # just the next twenty
    just dj --list       # what's recorded, and what's still to do
    just dj --relevel    # level and encode the recorded lines again (from raw/, no credits)
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
RAW = HERE / "raw"
OUT = ROOT / "public" / "audio" / "dj"
MANIFEST = ROOT / "src" / "data" / "dj.json"

VOICE = "gdTrLNuwWUaxC0z5n1j7"  # Kees: Jerry, a warm, deep Dutch voice from the ElevenLabs library, speaking English
MODEL = "eleven_v4_turbo"  # natural and quick, at half the credits a character of v4
SETTINGS = {"stability": 0.45, "similarity_boost": 0.8, "style": 0.3}
RESERVE = 1500  # credits left alone for the island's other sounds
LUFS = -16
# an intro that leans on the song before it ("again", "three in a row", "more from…")
FOLLOWING = re.compile(r"\b(again|back to back|back-to-back|twice|in a row|second one|another one from|more from|that last|"
                       r"the last one|just played|before that|after that one|same band|same man|same again|follow(s|ing) (that|on)|"
                       r"couldn't stop at one|third|fourth|fifth)\b", re.I)


def key() -> str:
    m = re.search(r"apiKey:\s*['\"]?([^'\"\s]+)", (ROOT / "config.yaml").read_text())
    if not m:
        sys.exit("No elevenlabs.apiKey in config.yaml")
    return m.group(1)


def api(path: str, body: dict | None = None) -> bytes:
    req = urllib.request.Request(f"https://api.elevenlabs.io{path}", headers={"xi-api-key": key(), "content-type": "application/json"},
                                 data=json.dumps(body).encode() if body else None)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def credits_left() -> int:
    s = json.loads(api("/v1/user/subscription"))
    return s["character_limit"] - s["character_count"]


def name(kind: str, ident: str, text: str) -> str:
    h = hashlib.sha1(f"{VOICE}|{MODEL}|{text}".encode()).hexdigest()[:8]
    return f"{kind}-{ident}-{h}.mp3"


def lines():
    """Every line to record, in the order to record them: (kind, ident, text, when). The chatter
    and his story first, then an intro for each song in the playlist's order (so a run of
    recordings covers a stretch of it), then the songs' second intros, his takes on them, what he
    says after some of them (afters-*.json), and last their moment intros, which only play when
    the hour or the weather is right for them."""
    for f in sorted((HERE / "lines").glob("chatter*.json")):
        for c in json.loads(f.read_text()):
            yield "chat", c["id"], c["text"], c.get("when")
    story = HERE / "lines" / "story.json"
    for c in json.loads(story.read_text()) if story.exists() else []:
        yield "story", c["id"], c["text"], None
    records = json.loads((ROOT / "src" / "data" / "radio.json").read_text())
    for kind, pattern in (("intro", "intros-*.json"), ("take", "takes-*.json"), ("after", "afters-*.json")):
        texts = {}
        for f in sorted((HERE / "lines").glob(pattern)):
            texts.update(json.loads(f.read_text()))
        for r in records:
            if r["id"] in texts:
                yield kind, r["id"], texts[r["id"]], None
    on_board = {r["id"] for r in records}
    for f in sorted((HERE / "lines").glob("moments*.json")):
        for m in json.loads(f.read_text()):
            if m["track"] in on_board:
                yield "moment", m["track"], m["text"], m["when"]


def following() -> list[str]:
    """The songs that follow on from the one before in the playlist, so the radio doesn't jump to
    them when it shuffles: the same artist again, or an intro that refers back."""
    records = json.loads((ROOT / "src" / "data" / "radio.json").read_text())
    texts: dict[str, list[str]] = {}
    for f in sorted((HERE / "lines").glob("intros-*.json")) + sorted((HERE / "lines").glob("takes-*.json")):
        for track, text in json.loads(f.read_text()).items():
            texts.setdefault(track, []).append(text)
    out = []
    for before, r in zip(records[-1:] + records[:-1], records):
        artists = lambda s: {a.strip() for a in s["artist"].split(",")}
        if artists(before) & artists(r) or any(FOLLOWING.search(t) for t in texts.get(r["id"], [])):
            out.append(r["id"])
    return out


def record(text: str, raw: Path, out: Path):
    if not raw.exists():
        raw.write_bytes(api(f"/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
                            {"text": text, "model_id": MODEL, "language_code": "en", "voice_settings": SETTINGS}))
    # mono, the silence trimmed off both ends, levelled, and at a bitrate for a voice on the radio
    trim = "silenceremove=start_periods=1:start_threshold=-50dB"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-ac", "1",
                    "-af", f"{trim},areverse,{trim},areverse,loudnorm=I={LUFS}:TP=-1.5:LRA=11",
                    "-ar", "44100", "-b:a", "48k", str(out)], check=True)


def main(args: list[str]):
    RAW.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    most = int(args[args.index("--max") + 1]) if "--max" in args else 10**9
    todo = [(k, i, t, w) for k, i, t, w in lines() if not (OUT / name(k, i, t)).exists()]
    if "--relevel" in args:
        for kind, ident, text, _ in lines():
            f = name(kind, ident, text)
            if (OUT / f).exists() and (RAW / f).exists():
                record(text, RAW / f, OUT / f)
    elif "--list" in args:
        print(f"{len(todo)} lines still to record ({sum(len(t) for _, _, t, _ in todo)} characters)")
    else:
        left = credits_left()
        done = 0
        for kind, ident, text, _ in todo:
            # what a line costs depends on the plan and the model, so ask how many are left
            # every so often, and stop with room for a line to spare
            if done and done % 10 == 0:
                left = credits_left()
            if done >= most or left - len(text) < RESERVE:
                print(f"Stopping: {left} credits left (keeping {RESERVE}). {len(todo) - done} lines to go.")
                break
            f = name(kind, ident, text)
            record(text, RAW / f, OUT / f)
            done += 1
            print(f"[{done}] {f}  {text[:70]}")
    # the manifest: what's on tape. Old takes of edited lines are left for `git clean`.
    chat, story, intros, afters, moments = [], [], {}, {}, []
    for kind, ident, text, when in lines():
        f = name(kind, ident, text)
        if not (OUT / f).exists():
            continue
        if kind == "chat":
            chat.append({"id": ident, "file": f, **({"when": when} if when else {})})
        elif kind == "story":
            story.append({"id": ident, "file": f})
        elif kind == "moment":
            moments.append({"track": ident, "file": f, "when": when})
        elif kind == "after":
            afters.setdefault(ident, []).append(f)
        else:
            intros.setdefault(ident, []).append(f)
    MANIFEST.write_text(json.dumps({"chatter": chat, "story": story, "intros": intros, "afters": afters, "moments": moments,
                                    "follows": following()}, indent=1) + "\n")
    print(f"On tape: {len(chat)} bits of chatter, {len(story)} instalments of his story, "
          f"{sum(len(v) for v in intros.values())} intros for {len(intros)} songs, {len(moments)} for the moment "
          f"({MANIFEST.relative_to(ROOT)})")


if __name__ == "__main__":
    main(sys.argv[1:])
