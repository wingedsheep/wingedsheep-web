"""
The rooms' doors, made rather than generated: the generated ones all came out creaking and
clanging, and asked not to, came out silent. These are built from a few small parts: a latch
(a short click with a little ring to it), a knock of wood (a panel's handful of modes, each dying
away), the air of the door swinging, and the room they open into. No creaks.

    just door-sounds

Writes public/audio/sfx/{door-hut,door-library,door-lighthouse,bell,hatch}.mp3, levelled like the
generated one-shots (-18 LUFS, mono), so their volumes in src/island/sound.ts carry over.
"""

import re
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

SR = 44100
LUFS = -18
OUT = Path(__file__).resolve().parents[2] / 'public/audio/sfx'
rng = np.random.default_rng(7)  # the same doors every time


def silence(seconds):
    return np.zeros(int(SR * seconds))


def lowpass(x, hz):
    """One-pole, run twice: soft enough for noise, cheap enough not to care."""
    a = np.exp(-2 * np.pi * hz / SR)
    for _ in range(2):
        y = np.empty_like(x)
        acc = 0.0
        for i, v in enumerate(x):
            acc = (1 - a) * v + a * acc
            y[i] = acc
        x = y
    return x


def band(x, lo, hi):
    return lowpass(x, hi) - lowpass(x, lo)


def modes(freqs, decays, amps, seconds, detune=0.0):
    """Damped sinusoids: what's left ringing of a struck panel, bar or bell."""
    t = np.arange(int(SR * seconds)) / SR
    out = np.zeros_like(t)
    for f, d, a in zip(freqs, decays, amps):
        f *= 1 + detune * rng.uniform(-1, 1)
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)) * np.exp(-t / d)
    # a couple of milliseconds' attack, so nothing starts with a digital tick
    out[: int(SR * 0.002)] *= np.linspace(0, 1, int(SR * 0.002))
    return fade(out, seconds / 3)  # and let it die away rather than stop


def knock(freqs, decays, amps, soft, seconds=0.4):
    """Something hitting wood: the modes, plus the thud of the blow itself (softer is duller)."""
    ring = modes(freqs, decays, amps, seconds, detune=0.02)
    n = int(SR * 0.012)
    thud = np.zeros(int(SR * seconds))
    thud[:n] = lowpass(rng.standard_normal(n), soft) * np.exp(-np.arange(n) / (n / 4))
    return ring + thud * 3


def swing(seconds, lo, hi, level):
    """The door moving through the air: filtered noise that swells and fades."""
    n = int(SR * seconds)
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    return band(rng.standard_normal(n), lo, hi) * env * level


def room(x, seconds, bright, wet):
    """A room to hear it in: decaying noise as its echo, darker as it dies."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t / (seconds / 6))
    ir = lowpass(ir, bright)
    ir[0] = 0
    ir /= np.sqrt(np.sum(ir**2))
    size = len(x) + len(ir) - 1
    tail = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)
    dry = np.concatenate([x, np.zeros(len(tail) - len(x))])
    return dry + tail * wet


def mix(length, *parts):
    """Lay (at_seconds, sound) parts into one track, at least `length` long and never cutting one off."""
    out = silence(max([length] + [at + len(s) / SR for at, s in parts]) + 0.01)
    for at, s in parts:
        i = int(SR * at)
        out[i : i + len(s)] += s
    return out


def fade(x, seconds=0.05):
    n = int(SR * seconds)
    x[-n:] *= np.linspace(1, 0, n)
    return x


# --- the doors ---


def hut():
    """A small cabin door: the wooden latch lifts, the door swings, a light tap as it opens to the wall."""
    latch = knock([820, 1650, 2480], [0.03, 0.02, 0.012], [1, 0.5, 0.25], soft=3000, seconds=0.15)
    tap = knock([190, 420, 700], [0.07, 0.05, 0.03], [1, 0.5, 0.3], soft=900) * 0.35
    dry = mix(0.9, (0, latch), (0.06, swing(0.5, 250, 900, 0.5)), (0.55, tap))
    return room(dry, 0.25, 3000, 0.25)


def library():
    """A solid old door: a brass latch clicks, the heavy door breathes open and settles with a soft thump."""
    click = modes([2350, 3720, 5100], [0.025, 0.018, 0.01], [0.6, 0.35, 0.15], 0.1)
    click += knock([700, 1400], [0.02, 0.012], [0.6, 0.3], soft=2500, seconds=0.1)
    thump = knock([105, 230, 385, 610], [0.12, 0.08, 0.05, 0.03], [1, 0.6, 0.35, 0.2], soft=500, seconds=0.5) * 0.5
    dry = mix(1.3, (0, click), (0.1, swing(0.75, 150, 600, 0.6)), (0.8, thump))
    return room(dry, 0.6, 2200, 0.35)


def lighthouse():
    """A heavy door in a stone tower: an iron latch clunks, the door swings, the stone room answers."""
    clunk = modes([540, 1320, 2150, 3050], [0.09, 0.05, 0.03, 0.015], [0.8, 0.45, 0.25, 0.1], 0.3, detune=0.01)
    clunk += knock([160, 340], [0.06, 0.04], [0.8, 0.4], soft=700, seconds=0.3)
    clunk = lowpass(clunk, 3500)
    thump = knock([85, 190, 320], [0.14, 0.09, 0.05], [1, 0.5, 0.3], soft=400, seconds=0.5) * 0.45
    dry = mix(1.4, (0, clunk), (0.12, swing(0.8, 120, 500, 0.6)), (0.9, thump))
    return room(dry, 1.1, 1800, 0.5)


def bell():
    """The workshop's shop bell on its spring: struck by the door, then jingling itself out."""
    f0 = 1760
    ratios, decays, amps = [1, 1.51, 2.03, 2.76], [0.55, 0.3, 0.2, 0.1], [1, 0.4, 0.25, 0.12]
    strikes = [(0, 1), (0.1, 0.55), (0.19, 0.4), (0.3, 0.22), (0.43, 0.12)]
    parts = [(at, modes([f0 * r for r in ratios], decays, amps, 1.0, detune=0.004) * a) for at, a in strikes]
    dry = mix(1.3, *parts, (0, swing(0.4, 300, 1000, 0.08)))
    return room(lowpass(dry, 7000), 0.3, 4000, 0.2)


def hatch():
    """The lighthouse stairs: two soft steps up the wood, the trapdoor lifted and laid back."""
    step = lambda: knock([95, 210, 350], [0.08, 0.05, 0.03], [1, 0.45, 0.25], soft=600, seconds=0.35)
    lay = knock([140, 310, 520], [0.1, 0.06, 0.04], [1, 0.5, 0.3], soft=800, seconds=0.45) * 0.5
    dry = mix(1.7, (0, step() * 0.7), (0.38, step()), (0.7, swing(0.6, 200, 700, 0.45)), (1.2, lay))
    return room(dry, 0.5, 2000, 0.3)


# --- out ---


def write(name, x):
    x = fade(x / np.max(np.abs(x)) * 0.5)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / f'{name}.wav'
        with wave.open(str(wav), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((x * 32767).astype(np.int16).tobytes())
        report = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
        lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', report)[-1])
        subprocess.run([
            'ffmpeg', '-y', '-loglevel', 'error', '-i', wav,
            '-af', f'volume={LUFS - lufs:.2f}dB,alimiter=limit=0.7:attack=2:release=60:level=false',
            '-ar', str(SR), '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', OUT / f'{name}.mp3',
        ], check=True)
    print(f'{name}: {len(x) / SR:.2f}s')


if __name__ == '__main__':
    for name, make in [('door-hut', hut), ('door-library', library), ('door-lighthouse', lighthouse), ('bell', bell), ('hatch', hatch)]:
        write(name, make())
