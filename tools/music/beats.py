# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["librosa>=0.10", "soundfile"]
# ///
"""Find the beats and chord changes in Vincent's guitar recordings, so his hands keep time.

    uv run tools/music/beats.py

For every song in src/data/songs.json (from public/audio/guitar-<id>.m4a) writes to
src/data/beats.json, under the song's id:
  beats   the time in seconds of every beat: he strums down on each, and up in between
  chords  [beat, chord] wherever the chord changes, from that beat on: 0-11 is a major chord on
          that root (0 = C), 12-23 the minor one. His fretting hand moves on each change.
The chords are a rough guess (the chroma of each beat matched to major and minor triads, then
smoothed so a chord holds for at least two beats), but they change when the song does.
Run it again after adding a song.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SONGS = ROOT / "src" / "data" / "songs.json"
OUT = ROOT / "src" / "data" / "beats.json"
SR = 22050
MIN_BEATS = 2  # a chord holds at least this long


def load(path: Path) -> np.ndarray:
    """Decode with ffmpeg (librosa can't read .m4a on its own) to mono float samples."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def beats(y: np.ndarray) -> tuple[float, np.ndarray]:
    onset = librosa.onset.onset_strength(y=y, sr=SR)
    tempo, frames = librosa.beat.beat_track(onset_envelope=onset, sr=SR, units="frames")
    return float(np.atleast_1d(tempo)[0]), frames


def triads() -> np.ndarray:
    """Chroma templates for the 12 major then the 12 minor triads, unit length."""
    t = np.zeros((24, 12))
    for root in range(12):
        for i, third in ((root, 4), (root + 12, 3)):
            t[i, [root, (root + third) % 12, (root + 7) % 12]] = 1
    return t / np.linalg.norm(t, axis=1, keepdims=True)


def chords(y: np.ndarray, frames: np.ndarray) -> list[list[int]]:
    """The chord on each beat, as [beat, chord] at every change."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=SR)
    per_beat = librosa.util.sync(chroma, frames, aggregate=np.median)[:, 1:len(frames)]  # beat i to i + 1
    per_beat /= np.linalg.norm(per_beat, axis=0, keepdims=True) + 1e-9
    fit = np.exp(triads() @ per_beat * 20)
    fit /= fit.sum(axis=0, keepdims=True)
    labels = librosa.sequence.viterbi_discriminative(fit, librosa.sequence.transition_loop(24, 0.8))
    runs = [[0, int(labels[0])]]
    for i, c in enumerate(labels[1:], 1):
        if c == runs[-1][1]:
            continue
        if i - runs[-1][0] < MIN_BEATS and len(runs) > 1:
            runs.pop()  # too short to be a real change: fold it into the chord before
            if runs[-1][1] == c:
                continue
        runs.append([i, int(c)])
    return runs


def main():
    names = "C C# D D# E F F# G G# A A# B".split()
    out = {}
    for song in json.loads(SONGS.read_text()):
        y = load(ROOT / "public" / "audio" / f"guitar-{song['id']}.m4a")
        tempo, frames = beats(y)
        times = librosa.frames_to_time(frames, sr=SR)
        changes = chords(y, frames)
        out[str(song["id"])] = {"beats": [round(float(t), 2) for t in times], "chords": changes}
        common = np.bincount([c for _, c in changes], minlength=24).argsort()[::-1][:4]
        print(f"{song['title']:<40} {tempo:5.1f} bpm  {len(times)} beats  {len(changes)} chord changes"
              f" (every {len(times) / len(changes):.1f} beats; mostly {' '.join(names[c % 12] + 'm' * int(c >= 12) for c in common)})")
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
