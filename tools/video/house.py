"""
The house film on the commissions page: a screen recording of the house walkthrough, cut
down to half a minute, cropped clear of the app's toolbars (and the address in its corner),
graded a touch and crossfaded. Timings are seconds into the recording.

    python3 tools/video/house.py "<recording>.mp4" public/work/house.mp4
    ffmpeg -ss 3 -i public/work/house.mp4 -frames:v 1 -q:v 4 public/work/house.jpg
"""
import subprocess, sys
src, out = sys.argv[1], sys.argv[2]
# (start, end, speed); a list of pieces is hard-cut together into one shot
shots = [
    [(0.3, 4.6, 1.0)],                      # the swoop down over the house
    [(8.4, 9.8, 1.0), (12.6, 13.9, 1.0)],   # day into night and back
    [(21.0, 31.0, 1.6)],                    # ground floor plan, turning
    [(32.5, 35.5, 1.5)],                    # upstairs plan
    [(46.8, 49.6, 1.0)],                    # kitchen
    [(62.0, 65.6, 1.0)],                    # living room
    [(68.0, 71.0, 1.0)],                    # garden
    [(75.0, 77.8, 1.0)],                    # back of the house
    [(79.0, 80.9, 1.0)],                    # dining room
    [(86.0, 88.9, 1.0)],                    # stairs, landing
    [(109.0, 110.9, 0.85)],                 # bedroom
]
X = 0.4  # crossfade
look = "crop=996:560:462:140,scale=1280:720:flags=lanczos,eq=contrast=1.05:saturation=1.1:gamma=0.98,unsharp=5:5:0.4,fps=30,format=yuv420p,settb=1/30"
parts, labels, durs = [], [], []
n = 0
for i, shot in enumerate(shots):
    names = []
    d = 0
    for (a, b, sp) in shot:
        # walking (shot 4 on) shows a crosshair in the middle of the screen: paint it out
        hide = ",delogo=x=628:y=370:w=24:h=24" if i >= 4 else ""
        parts.append(f"[0:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},{look}{hide}[p{n}]")
        names.append(f"[p{n}]"); n += 1; d += (b - a) / sp
    if len(names) > 1:
        parts.append(f"{''.join(names)}concat=n={len(names)}:v=1:a=0,settb=1/30[s{i}]")
    else:
        parts.append(f"{names[0]}null[s{i}]")
    durs.append(d)
cur, t = "[s0]", durs[0]
for i in range(1, len(shots)):
    off = t - X
    parts.append(f"{cur}[s{i}]xfade=transition=fade:duration={X}:offset={off:.3f}[x{i}]")
    cur, t = f"[x{i}]", off + durs[i]
parts.append(f"{cur}fade=t=in:st=0:d=0.6,fade=t=out:st={t-0.8:.3f}:d=0.8,vignette=PI/7,format=yuv420p[out]")
cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", ";".join(parts), "-map", "[out]", "-an",
       "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "high", "-movflags", "+faststart", out]
subprocess.run(cmd, check=True)
print(f"{t:.1f}s")
