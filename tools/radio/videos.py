"""Radio Alles's records: the playlist, each song matched to a YouTube video the radio can play.

The tracklist is an Exportify export of the Spotify playlist "alles" (tools/radio/*.csv), or,
until there is one, seed.json (the first hundred, from Spotify's embed). For each song this
searches YouTube once, prefers the artist's own audio upload (the "Artist - Topic" channels) at
the right length over live versions, covers and lyric videos, and checks the video may be
embedded. Answers are kept in videos.json, so a second run only looks up what's new; delete an
entry to look it up again, or set it by hand to pin a video.

    just radio            # look up what's missing, write src/data/radio.json
"""
from __future__ import annotations

import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
CACHE = HERE / "videos.json"
OUT = HERE.parent.parent / "src" / "data" / "radio.json"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "Accept-Language": "en"}
# what Spotify adds to a title that a video won't have
NOISE = re.compile(r"\s+-\s+(\d{4} )?(Remaster(ed)?|Radio Version|Radio Edit|Single Version|Mono|Stereo|Digital Remaster|Remix(ed)?|Surround Sound|Live At|Remixed Live)\b.*$", re.I)
WRONG = ("cover", "karaoke", "instrumental", "8d audio", "slowed", "reverb", "sped up", "nightcore", "reaction", "lesson", "tutorial")


def tracks() -> list[dict]:
    """The playlist, oldest first: from the newest Exportify CSV here, or the seed."""
    exports = sorted(HERE.glob("*.csv"), key=lambda p: p.stat().st_mtime)
    if not exports:
        return json.loads((HERE / "seed.json").read_text())
    out = []
    with exports[-1].open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            uri = row.get("Track URI") or row.get("Spotify URI") or ""
            if not uri.startswith("spotify:track:"):
                continue  # (a podcast episode, or a local file)
            out.append({
                "id": uri.split(":")[-1],
                "title": row.get("Track Name", ""),
                "artist": (row.get("Artist Name(s)") or "").replace(";", ", "),
                "album": row.get("Album Name", ""),
                "year": (row.get("Album Release Date") or row.get("Release Date") or "")[:4],
                "ms": int(row.get("Duration (ms)") or row.get("Track Duration (ms)") or 0),
            })
    return out


def clean(title: str) -> str:
    return NOISE.sub("", title).strip()


def get(url: str) -> str:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return r.read().decode("utf-8", "replace")


def seconds(text: str) -> int:
    n = 0
    for part in text.split(":"):
        n = n * 60 + int(part or 0)
    return n


def search(query: str) -> list[dict]:
    html = get("https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": query, "hl": "en"}))
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not m:
        return []
    found = []

    def walk(node):
        if isinstance(node, dict):
            v = node.get("videoRenderer")
            if v and v.get("videoId") and v.get("lengthText"):
                found.append({
                    "video": v["videoId"],
                    "title": "".join(r.get("text", "") for r in v.get("title", {}).get("runs", [])),
                    "channel": "".join(r.get("text", "") for r in v.get("ownerText", {}).get("runs", [])),
                    "seconds": seconds(v["lengthText"].get("simpleText", "0")),
                })
            for x in node.values():
                walk(x)
        elif isinstance(node, list):
            for x in node:
                walk(x)

    walk(json.loads(m.group(1)))
    return found


def simple(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def score(c: dict, t: dict) -> float:
    title, artist = simple(clean(t["title"])), simple(t["artist"].split(",")[0])
    got, channel = simple(c["title"]), simple(c["channel"])
    s = 0.0
    if channel == f"{artist} topic":
        s += 4  # the artist's own audio, as released
    elif artist and artist in channel:
        s += 2.5  # their channel (or their Vevo)
    if title and title in got:
        s += 3
    if artist and artist in got:
        s += 1
    if t.get("ms"):
        off = abs(c["seconds"] - t["ms"] / 1000)
        s += 2 if off < 6 else 1 if off < 20 else -2 if off > 60 else 0
    asked = t["title"].lower()
    for w in WRONG:
        if w in c["title"].lower() and w not in asked:
            s -= 5
    if "live" in got.split() and "live" not in asked:
        s -= 2.5
    return s


def embeddable(video: str) -> bool:
    try:
        get("https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={video}"))
        return True
    except Exception:
        return False


def find(t: dict) -> dict | None:
    query = f"{t['artist'].split(',')[0]} {clean(t['title'])}"
    for c in sorted(search(query), key=lambda c: -score(c, t))[:4]:
        if score(c, t) < 3:
            break
        if embeddable(c["video"]):
            return c
        time.sleep(0.5)
    return None


def main():
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    songs = tracks()
    todo = [t for t in songs if t["id"] not in cache]
    for i, t in enumerate(todo):
        try:
            cache[t["id"]] = find(t)
        except Exception as e:  # (try again next run)
            print(f"  ! {t['artist']} - {t['title']}: {e}", file=sys.stderr)
            continue
        c = cache[t["id"]]
        print(f"[{i + 1}/{len(todo)}] {t['artist']} - {clean(t['title'])}  ->  {c['video'] + '  ' + c['channel'] if c else 'nothing'}")
        if i % 20 == 19:
            CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False))
        time.sleep(1.2)
    CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False))
    records = [{"id": t["id"], "title": clean(t["title"]), "artist": t["artist"], "video": cache[t["id"]]["video"]}
               for t in songs if cache.get(t["id"])]
    OUT.write_text(json.dumps(records, indent=1, ensure_ascii=False) + "\n")
    missing = sum(1 for t in songs if not cache.get(t["id"]))
    print(f"{len(records)} records on board, {missing} without a video ({OUT.relative_to(HERE.parent.parent)})")


if __name__ == "__main__":
    main()
