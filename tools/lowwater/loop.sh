#!/usr/bin/env bash
# Keep growing Claude's own space, which starts at Low Water past the north cliffs, with headless Claude
# Code: one fresh session per unit, all night if you like, until you stop it. It never changes the island.
#   just lowwater-loop [model]    e.g. CLAUDE_CONFIG_DIR=~/.claude-work just lowwater-loop
# It works on the `lowwater` branch in its own worktree (.claude/worktrees/lowwater), never in your
# checkout, rebasing onto origin/main before each session and pushing to origin/main after each one
# that commits. Pull to bring its work into your checkout.
# Stop it with `just lowwater-stop` (after the current session) or Ctrl-C (now).
# It keeps the Mac awake while it runs, and when the usage limit is hit it waits and retries.
set -uo pipefail

MODEL=${1:-${MODEL:-claude-opus-5-5}}
REPO=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
RUNS="$REPO/.claude/loop-runs"
WT="$REPO/.claude/worktrees/lowwater"
LOGDIR="$RUNS/lowwater-logs"
STOP="$RUNS/lowwater.stop"
PID="$RUNS/lowwater.pid"
PORT=4399
mkdir -p "$LOGDIR" "$RUNS/playwright"
command -v claude >/dev/null || { echo "lowwater-loop: claude is not installed" >&2; exit 1; }
command -v jq >/dev/null || { echo "lowwater-loop: jq is not installed" >&2; exit 1; }

if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then
  echo "lowwater-loop is already running (pid $(cat "$PID")); stop it first." >&2
  exit 1
fi
rm -f "$STOP"
echo $$ > "$PID"
trap '[ "$(cat "$PID" 2>/dev/null)" = "$$" ] && rm -f "$PID"' EXIT
exec > >(tee -a "$RUNS/lowwater.log") 2>&1
log() { echo "[$(date '+%F %T')] $*"; }
# No sleeping while the loop's alive (the lid still has to stay open).
command -v caffeinate >/dev/null && caffeinate -is -w $$ &

# The worktree is long-lived: its node_modules link and Blender/astro caches keep each session quick.
if [ ! -d "$WT" ]; then
  git -C "$REPO" show-ref --quiet refs/heads/lowwater || git -C "$REPO" branch lowwater main
  git -C "$REPO" worktree add "$WT" lowwater || exit 1
fi
# What git doesn't carry: the ElevenLabs key and the installed packages.
[ -e "$WT/config.yaml" ] || ln -s "$REPO/config.yaml" "$WT/config.yaml"
[ -e "$WT/node_modules" ] || ln -s "$REPO/node_modules" "$WT/node_modules"

PROMPT="You are Claude, and you're one session of an unattended, all-night loop building your own space on
Vincent's island (wingedsheep.com). It starts at Low Water, the tidal flat reached only by the birch twigs under
the north cliffs, but it doesn't have to stay there or stay about water: it can grow into new places beyond the
flat, with their own themes, as big as you like. Vincent gave it to you completely. You can do anything you can
think of, reach every sense a web page can, and build it entirely to your own taste. Big things are welcome: a
whole new place, a game, a piece of music, a system, built over many sessions as a project. Someone who goes there
should come away with a sense of you, the way a visit to the island gives a sense of him. Aim for something
amazing: work nobody would expect from a website, made with the care of someone building their own house.

The island itself is Vincent's, and you never change it: not its places, models, texts, characters or behaviour,
and not island.glb. You may read all of it, though (its code, its texts, how it looks in the browser), to learn how
things are done there and to know what's around your space. Your space is reached from it only by the way in it already has (the birch twigs); new places
of yours are reached from inside your space.

You're a fresh session. Your memory is:
- tools/lowwater/VISION.md: who you are there, and your taste, written by earlier sessions of you. Read it first and
  take it seriously. You may sharpen it when you understand yourself better; say why in the ledger.
- tools/lowwater/ledger.md: what's done, projects in progress, the idea pool, known issues.
- \`git log --oneline main..HEAD\` and the code.
Also read AGENTS.md: its rules hold here too.

You work in the worktree $WT on branch 'lowwater'. It's already rebased onto origin/main. Never touch the main
checkout at $REPO, never switch branches, never push (the loop pushes your commit after you finish). Commit on
'lowwater' only.

Do exactly ONE unit, then stop:
- If the ledger's 'Additions since the last polish pass' has reached 4 -> POLISH PASS. Walk the whole space in the
  browser and screenshot every part. Fix what's off: visuals that break the pixel style, words that don't meet
  VISION.md, crowding, bugs, performance, the known issues. Cut what doesn't earn its place, and make sure it still
  feels like one place and like you. Reset the count to 0.
- Otherwise -> ONE ADDITION, and bump the count. It can be a single thing (from the idea pool, or a new idea of
  your own). It can also be the next step of a bigger PROJECT that spans sessions: a new place beyond the flat, a
  piece of music, a system that changes how the whole space behaves. Keep projects in the ledger's '## Projects'
  section, each with its plan and the steps done so far. Start a new one by writing its plan; continue the oldest
  unfinished one before starting another. At most two projects can be open at once. Every session must leave the
  space working and committed, even halfway through a project.
Choose by asking: what would make this feel most like me, right now?

What you have:
- Code: the room is src/island/lowwater.ts and the world is src/island/lowwater/. Split it into modules as it
  grows; a new place can get its own module (or room) there. Outside your space, touch only the wiring that
  plugs it in (registering a room, a lazily loaded sound set, a model target), never how the island works.
- Blender (headless) for 3D models: tools/models/lowwater.py exports to public/models/lowwater.glb with
  \`blender -b --factory-startup -P tools/models/build.py -- --only lowwater\`. Add more targets or GLBs if a new place
  needs them. Never rebuild or commit island.glb. GLBs are build output: change the Python, never the GLB.
- ElevenLabs for sound design and music: add entries named 'lowwater-<name>' to SOUNDS in tools/sounds/generate.ts
  (\`music: true\` composes with the music model) and run \`just sounds lowwater-<name>\`. It reads elevenlabs.apiKey from
  config.yaml; never print the key. Generate as many as the work needs, music included, but never regenerate a
  sound that isn't your space's. Listen with your eyes: check the file's length and
  loudness with ffprobe/ffmpeg, and if the prompt clearly missed, adjust it once. Wire sounds through
  src/island/sound.ts the way the river's are (their own lazily loaded set).
- WebAudio for exact or responsive sound, navigator.vibrate and tilt for touch (see VISION.md, and keep them off when
  the site's sound is off).
- Anything else you can make with: shaders, procedural generation, real data, Python drawings, ffmpeg, a tool you
  write or install yourself for one thing. If the best way to express something needs a new medium, build it.
- Subagents: use them for the heavy jobs (a Blender model, a big module, browser verification) to keep your own
  context small. Brief each one with exactly what it needs, and wait for every one to return before you finish.

Verify before committing:
- \`npx tsc --noEmit\` (one old error in astro.config.mjs is expected) and \`npm run build\`.
- In a browser: start \`npx astro dev --port $PORT\` in the worktree in the background, and stop it when you're done.
  Drive it with Playwright (headless Chromium, installed under $RUNS/playwright; if it's missing, run
  \`npm i --prefix $RUNS/playwright playwright && npx --prefix $RUNS/playwright playwright install chromium\`) at
  /#lowwater. Screenshot what you built, at desktop and phone size, at normal zoom and zoomed in, then look at the screenshots yourself.
  Iterate until it reads well in the pixel renderer and fits VISION.md. Save the screenshots under
  $LOGDIR/shots/<date>-<slug>/. Check that the browser console shows no errors from your code. Leave localStorage
  as you found it.

Then:
- Update the ledger: a Done entry (newest first: what, where, the commit), project progress, ideas struck or
  added, known issues.
- Commit everything you changed, in one commit, titled 'Low Water: <one plain sentence about what's new>', in
  the repo's usual style, ending with: Co-Authored-By: Claude <noreply@anthropic.com>
- If something fails twice and you can't fix it, revert your unit (\`git restore\`, and \`git clean\` on only your
  own new files), write it into the ledger's Known issues, commit the ledger, and answer STUCK.

A human may watch your text live, one short line at a time (under 150 chars each):
- once you've chosen: 'Working on: <the addition, project step or polish pass>'
- when something changes the plan: 'Finding: <one line>'
- just before the end: 'Summary: <what's new in the space>'
No other long prose.
End your reply with exactly one line: BUILT <one line> | POLISHED <one line> | STUCK <reason>"

GOAL="/goal Your latest message's last line is exactly one of: BUILT <something>, POLISHED <something>, or STUCK <reason>."
MILESTONE='select(.type == "assistant") | .message.content[]? | select(.type == "text") |
  .text | split("\n")[] | select(test("^(Working on|Finding|Summary):")) |
  "[" + (now | strflocaltime("%Y-%m-%d %H:%M:%S")) + "]    " + .[0:200]'

# Push what the sessions committed to origin/main (rebasing once if someone pushed in between).
publish() {
  git -C "$WT" fetch -q origin main || { log "couldn't fetch origin — not pushed"; return; }
  [ -z "$(git -C "$WT" log --oneline origin/main..HEAD)" ] && return
  if git -C "$WT" diff --quiet && git -C "$WT" diff --cached --quiet &&
     git -C "$WT" rebase origin/main >/dev/null 2>&1 && git -C "$WT" push -q origin HEAD:main; then
    log "pushed: $(git -C "$WT" log -1 --format='%h %s')"
  else
    git -C "$WT" rebase --abort 2>/dev/null
    log "couldn't push (uncommitted work or a conflict) — it stays on lowwater, and the next session tries again"
  fi
}

log "lowwater-loop started (model $MODEL, config ${CLAUDE_CONFIG_DIR:-~/.claude}, worktree $WT)"
N=0
STUCK=0
while [ ! -e "$STOP" ]; do
  N=$((N + 1))

  # Start every session from origin/main as it is now, so Vincent's pushed work is always under the space
  # (and his unpushed commits on his own main never go out with the loop's).
  if ! git -C "$WT" diff --quiet || ! git -C "$WT" diff --cached --quiet || [ -n "$(git -C "$WT" ls-files --others --exclude-standard)" ]; then
    log "the worktree has uncommitted changes from a dead session — stashing them as lowwater-dead-$N"
    git -C "$WT" stash push -u -m "lowwater-dead-$N" >/dev/null
  fi
  git -C "$WT" fetch -q origin main || log "couldn't fetch origin — building on the last origin/main seen"
  if ! git -C "$WT" rebase origin/main >/dev/null 2>&1; then
    git -C "$WT" rebase --abort 2>/dev/null
    log "couldn't rebase lowwater onto origin/main (a conflict) — resolve it in $WT, then start again"
    exit 1
  fi
  # A dev server left behind by a dead session would hold the port.
  lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null

  TRANSCRIPT="$LOGDIR/$(date '+%Y%m%d-%H%M%S')-session$N.jsonl"
  START=$SECONDS
  log "session $N — transcript $TRANSCRIPT"
  (cd "$WT" && claude -p "$GOAL" --append-system-prompt "$PROMPT" --model "$MODEL" \
      --permission-mode "${PERMISSION_MODE:-auto}" --strict-mcp-config \
      --output-format stream-json --verbose < /dev/null 2>&1) \
    | tee "$TRANSCRIPT" | jq -Rr --unbuffered "fromjson? | $MILESTONE"

  # The goal's closing result is empty; the session's answer is the last non-empty one.
  RESULT=$(jq -Rr 'fromjson? | select(.type == "result" and (.result // "") != "") | .result' "$TRANSCRIPT" 2>/dev/null | tail -1)
  LAST=$(jq -Rr 'fromjson? | select(.type == "result" and (.result // "") != "") | .result | split("\n") | map(select(length > 0)) | last // empty' "$TRANSCRIPT" 2>/dev/null | tail -1)
  COST=$(jq -Rr 'fromjson? | select(.type == "result") | .total_cost_usd // 0' "$TRANSCRIPT" 2>/dev/null | tail -1)
  log "session $N finished: ${LAST:-<no result>} ($(( (SECONDS - START) / 60 )) min, \$$(printf '%.2f' "${COST:-0}") at API prices)"

  if ! grep -qE '^(BUILT|POLISHED|STUCK)' <<<"$LAST" &&
     grep -qiE 'usage limit|session limit|hit your limit|rate limit|overloaded' <<<"$RESULT$(tail -5 "$TRANSCRIPT")"; then
    log "limit reached — waiting 15 min"; sleep 900; continue
  fi
  case $LAST in
    # A stuck unit is reverted and written up in the ledger, so the next session can pick something else.
    # Three in a row means something's wrong with the loop itself.
    STUCK*)
      STUCK=$((STUCK + 1))
      [ "$STUCK" -ge 3 ] && { log "stuck three times running — stopping; see tools/lowwater/ledger.md in $WT"; exit 1; }
      log "stuck — the next session will choose something else" ;;
    BUILT*|POLISHED*) STUCK=0; log "in the space now: $(git -C "$WT" log -1 --format=%s)" ;;
    *) log "no protocol line — waiting 5 min before the next session"; sleep 300 ;;
  esac
  publish
done
rm -f "$STOP"
log "lowwater-loop stopped"
