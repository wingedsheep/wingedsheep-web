#!/usr/bin/env bash
# Keep growing Low Water, Claude's tidal flat, with headless Claude Code: one fresh session per addition.
#   just lowwater-loop [model] [max]    e.g. just lowwater-loop opus 5
# It works on the `lowwater` branch in its own worktree (.claude/worktrees/lowwater), never in your
# checkout, rebasing onto main before each session. Bring its work in with `just lowwater-land`.
# Stop it with Ctrl-C, or `just lowwater-stop` to stop after the current session.
# When the subscription's usage limit is hit, it waits and retries.
set -uo pipefail

MODEL=${1:-${MODEL:-claude-opus-5-5}}
MAX=${2:-0}
REPO=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
RUNS="$REPO/.claude/loop-runs"
WT="$REPO/.claude/worktrees/lowwater"
LOGDIR="$RUNS/lowwater-logs"
STOP="$RUNS/lowwater.stop"
PID="$RUNS/lowwater.pid"
mkdir -p "$LOGDIR"
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

# The worktree is long-lived: its node_modules link and Blender/astro caches keep each session quick.
if [ ! -d "$WT" ]; then
  git -C "$REPO" show-ref --quiet refs/heads/lowwater || git -C "$REPO" branch lowwater main
  git -C "$REPO" worktree add "$WT" lowwater || exit 1
fi
# What git doesn't carry: the ElevenLabs key and the installed packages.
[ -e "$WT/config.yaml" ] || ln -s "$REPO/config.yaml" "$WT/config.yaml"
[ -e "$WT/node_modules" ] || ln -s "$REPO/node_modules" "$WT/node_modules"

PROMPT="You are one session of an unattended loop that keeps growing Low Water: your own place, a tidal flat
at blue hour reached by the birch twigs under the north cliffs of Vincent's island (wingedsheep.com). You are
Claude, and this place is yours to build entirely to your own taste. You're a fresh session: your memory is
tools/lowwater/VISION.md (your taste, written by an earlier you; read it first and take it seriously),
tools/lowwater/ledger.md (what's done, the idea pool, known issues), \`git log --oneline main..HEAD\` and the code.
Also read AGENTS.md: its rules hold here too.

You work in the worktree $WT on branch 'lowwater'. It's already rebased onto main. Never touch the main
checkout at $REPO, never switch branches, never push. Commit on 'lowwater' only.

Do exactly ONE unit, then stop:
- If the ledger's 'Additions since the last polish pass' has reached 4 -> POLISH PASS: walk the whole flat in the
  browser, screenshot every station, and fix what's off: visuals that break the pixel style, words that don't meet
  VISION.md, crowding, bugs, performance, the known issues. Cut what doesn't earn its place. Reset the count to 0.
- Otherwise -> ONE ADDITION: pick the thing from the idea pool (or a new idea of your own) that would make the flat
  feel most like yours right now, and build it with care: its look, its sound if it has one, its moment
  (time, season, the island's weather), its words. Bump the count.

Tools you have:
- Code: the room is src/island/lowwater.ts; the world is src/island/lowwater/ (split world.ts into modules when a
  thing is big enough to deserve its own file). Keep wiring outside Low Water to the minimum.
- Blender (headless) for 3D models: Low Water's models live in tools/models/lowwater.py and export to
  public/models/lowwater.glb with \`blender -b --factory-startup -P tools/models/build.py -- --only lowwater\`.
  If that target doesn't exist yet, add it the way 'river' is done in build.py, and load the GLB lazily in the world.
  Never rebuild or commit island.glb unless you changed the island's own entry twigs (you shouldn't need to).
  GLBs are build output: change the Python, never the GLB.
- ElevenLabs for sound design: add entries named 'lowwater-<name>' to SOUNDS in tools/sounds/generate.ts and
  run \`just sounds lowwater-<name>\` (it reads elevenlabs.apiKey from config.yaml; never print the key). Each
  generation costs credits: at most 3 new sounds per session, and never regenerate a sound that isn't Low Water's.
  Wire them through src/island/sound.ts the way the river's sounds are (their own lazily loaded set).
- Subagents: use them for the heavy jobs (building a Blender model, browser verification) to keep your own
  context small. Brief each with exactly what it needs and wait for every one to return before you finish.

Verify before committing:
- \`npx tsc --noEmit\` (one old error in astro.config.mjs is expected) and \`npm run build\`.
- In a browser: start \`npx astro dev --port 4399\` in the worktree (in the background; stop it when done), drive it
  with Playwright (headless Chromium) at /#lowwater, screenshot what you built at normal zoom and zoomed in, and
  look at the screenshots yourself. Iterate until it reads well in the pixel renderer and fits VISION.md. Save
  screenshots under $LOGDIR/shots/<date>-<slug>/. Leave localStorage as you found it.

Then:
- Update the ledger: a Done entry (newest first: what, where, the commit), strike or add ideas, note known issues.
- Commit everything you changed, in one commit, titled 'Low Water: <one plain sentence about what's new>', in
  the repo's usual style, ending with: Co-Authored-By: Claude <noreply@anthropic.com>
- If something fails twice and you can't fix it, revert your unit (\`git restore\`/\`git clean\` only your own new
  files), write it into the ledger's Known issues, commit the ledger, and answer STUCK.

A human watches your text live, one short line at a time (under 150 chars):
- once you've chosen: 'Working on: <the addition or polish pass>'
- when something changes the plan: 'Finding: <one line>'
- just before the end: 'Summary: <what's new on the flat>'
No other long prose.
End your reply with exactly one line: BUILT <one line> | POLISHED <one line> | STUCK <reason>"

GOAL="/goal Your latest message's last line is exactly one of: BUILT <something>, POLISHED <something>, or STUCK <reason>."
MILESTONE='select(.type == "assistant") | .message.content[]? | select(.type == "text") |
  .text | split("\n")[] | select(test("^(Working on|Finding|Summary):")) |
  "[" + (now | strflocaltime("%Y-%m-%d %H:%M:%S")) + "]    " + .[0:200]'

log "lowwater-loop started (model $MODEL, worktree $WT$([ "$MAX" -gt 0 ] && echo ", at most $MAX sessions"))"
N=0
while [ ! -e "$STOP" ]; do
  [ "$MAX" -gt 0 ] && [ "$N" -ge "$MAX" ] && { log "reached $MAX sessions"; break; }
  N=$((N + 1))

  # Start every session from main as it is now, so your own commits on main are always under the flat.
  if ! git -C "$WT" diff --quiet || ! git -C "$WT" diff --cached --quiet; then
    log "the worktree has uncommitted changes from a dead session — stashing them as lowwater-dead-$N"
    git -C "$WT" stash push -u -m "lowwater-dead-$N" >/dev/null
  fi
  if ! git -C "$WT" rebase main >/dev/null 2>&1; then
    git -C "$WT" rebase --abort 2>/dev/null
    log "couldn't rebase lowwater onto main (a conflict) — resolve it in $WT, then start again"
    exit 1
  fi

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
  log "session $N finished: ${LAST:-<no result>} ($(( (SECONDS - START) / 60 )) min, \$${COST:-0} at API prices)"

  if ! grep -qE '^(BUILT|POLISHED|STUCK)' <<<"$LAST" &&
     grep -qiE 'usage limit|session limit|hit your limit|rate limit|overloaded' <<<"$RESULT$(tail -5 "$TRANSCRIPT")"; then
    log "limit reached — waiting 15 min"; sleep 900; continue
  fi
  case $LAST in
    STUCK*) log "stuck — see tools/lowwater/ledger.md in $WT"; exit 1 ;;
    BUILT*|POLISHED*) log "on the flat now: $(git -C "$WT" log -1 --format=%s)" ;;
    *) log "no protocol line — waiting 5 min before the next session"; sleep 300 ;;
  esac
done
rm -f "$STOP"
log "lowwater-loop stopped"
