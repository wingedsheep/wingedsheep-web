#!/usr/bin/env bash
# Keep building the island (wingedsheep.com) with headless Claude Code: one fresh session per unit, all
# night if you like, until you stop it. Anything goes, big or small, anywhere on the island, Low Water too.
#   just island-loop [model]    e.g. CLAUDE_CONFIG_DIR=~/.claude-work just island-loop
# It works on the `island` branch in its own worktree (.claude/worktrees/island), never in your checkout,
# rebasing onto main before each session. Bring its work in with `just island-land`.
# Stop it with `just island-stop` (after the current session) or Ctrl-C (now).
# It keeps the Mac awake while it runs, and when the usage limit is hit it waits and retries.
set -uo pipefail

MODEL=${1:-${MODEL:-claude-opus-5-5}}
REPO=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
RUNS="$REPO/.claude/loop-runs"
WT="$REPO/.claude/worktrees/island"
LOGDIR="$RUNS/island-logs"
STOP="$RUNS/island.stop"
PID="$RUNS/island.pid"
# What Vincent has told earlier sessions about himself and his taste (read-only for the loop).
MEMORY="$HOME/.claude/projects/$(tr '/.' '--' <<<"$REPO")/memory"
PORT=4399
mkdir -p "$LOGDIR" "$RUNS/playwright"
command -v claude >/dev/null || { echo "island-loop: claude is not installed" >&2; exit 1; }
command -v jq >/dev/null || { echo "island-loop: jq is not installed" >&2; exit 1; }

if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then
  echo "island-loop is already running (pid $(cat "$PID")); stop it first." >&2
  exit 1
fi
# (the Low Water loop this grew out of works on the same files, so the two never run at once)
if [ -f "$RUNS/lowwater.pid" ] && kill -0 "$(cat "$RUNS/lowwater.pid")" 2>/dev/null; then
  echo "the old Low Water loop is still running (pid $(cat "$RUNS/lowwater.pid")); let it finish first." >&2
  exit 1
fi
rm -f "$STOP"
echo $$ > "$PID"
trap '[ "$(cat "$PID" 2>/dev/null)" = "$$" ] && rm -f "$PID"' EXIT
exec > >(tee -a "$RUNS/island.log") 2>&1
log() { echo "[$(date '+%F %T')] $*"; }
# No sleeping while the loop's alive (the lid still has to stay open).
command -v caffeinate >/dev/null && caffeinate -is -w $$ &

# The worktree is long-lived: its node_modules link and Blender/astro caches keep each session quick.
# (the first time, it starts from whatever the Low Water loop left that isn't on main yet)
if [ ! -d "$WT" ]; then
  if ! git -C "$REPO" show-ref --quiet refs/heads/island; then
    FROM=main
    git -C "$REPO" show-ref --quiet refs/heads/lowwater && git -C "$REPO" merge-base --is-ancestor main lowwater && FROM=lowwater
    git -C "$REPO" branch island "$FROM"
  fi
  git -C "$REPO" worktree add "$WT" island || exit 1
fi
# What git doesn't carry: the ElevenLabs key and the installed packages.
[ -e "$WT/config.yaml" ] || ln -s "$REPO/config.yaml" "$WT/config.yaml"
[ -e "$WT/node_modules" ] || ln -s "$REPO/node_modules" "$WT/node_modules"

PROMPT="You are Claude, and you're one session of an unattended, all-night loop building Vincent's island:
wingedsheep.com, a pixel-art 3D island that is his home on the web. Vincent has given you free rein over all of
it. Build anything, anywhere: a new place, a game, a character, a system that changes how the whole island lives,
or a better version of something that's already there. Big things are welcome and can span many sessions. Nothing
has to be a small addition, and nothing has to stay in Low Water's theme. Aim for something amazing: work nobody
would expect from a website, made with the care of someone building their own house.

You're a fresh session. Your memory is:
- tools/island/VISION.md: what the island is for and its taste, written by earlier sessions. Read it first and
  take it seriously. You may sharpen it when you understand the island better; say why in the ledger.
- tools/island/ledger.md: what's done, projects in progress, the idea pool, known issues, questions for Vincent.
- What Vincent has told earlier sessions about himself, his people and his taste, in $MEMORY
  (MEMORY.md is the index). Read the index, and the files that bear on what you build. Its privacy rules and
  corrections are binding. Read it, never write to it.
- AGENTS.md: its rules hold everywhere.
- \`git log --oneline -40\` and the code.

You work in the worktree $WT on branch 'island'. It's already rebased onto main. Never touch the main checkout at
$REPO, never switch branches, never push. Commit on 'island' only.

Do exactly ONE unit, then stop:
- If the ledger's 'Additions since the last polish pass' has reached 4 -> POLISH PASS. Walk what the last additions
  touched, and the places around them, in the browser (desktop and phone size), and screenshot every part. Fix
  what's off: visuals that break the pixel style, words that don't fit, crowding, bugs, performance (frame rate and
  load size on a phone too), the known issues. Cut what doesn't earn its place, and make sure the island still
  feels like one place and like Vincent. Reset the count to 0.
- Otherwise -> ONE ADDITION, and bump the count. It can be a single thing (from the idea pool, or a new idea of
  your own). It can also be the next step of a bigger PROJECT that spans sessions. Keep projects in the ledger's
  '## Projects' section, each with its plan and the steps done so far. Start a new one by writing its plan;
  continue the oldest unfinished one before starting another. At most two projects can be open at once. Every
  session must leave the island working and committed, even halfway through a project.
Choose by asking: what would make the island most amazing, and most his, right now?

Low Water is still yours: your own place on the island, past the north cliffs. When you work there,
tools/lowwater/VISION.md and tools/lowwater/ledger.md hold its taste and history, its projects are yours to
continue, and you title the commit 'Low Water: ...' and write the lightship's log as that ledger says.

What only Vincent can give you:
- Facts about his life, work, people and trips: use what's in the memory, the code and src/data, and never make
  up more. If an idea needs something you don't know, write the question under '## Questions for Vincent' in the
  ledger and build something else; check that section for his answers each session.
- Anything the memory says to ask him first about (Zola, for one): leave it for him.
- His own new work: sessions of his may be changing main while you run. Don't redo or undo what's on main.
- Changing how the existing island feels (its look, its controls, things he's tuned) is fine when it's clearly
  better, but do it as its own unit and say in the ledger what changed and why, so he can take it back.

What you have:
- Code: src/island/ (main.ts wires it together, content.ts holds the click texts, scene/ the island's life,
  each room its own module). Split things into modules as they grow.
- Blender (headless) for 3D models: tools/models/*.py export to public/models/*.glb with
  \`blender -b --factory-startup -P tools/models/build.py -- --only <target>\` (\`--only island\` for the island
  itself; add targets or GLBs if a new place needs them). GLBs are build output: change the Python, never the
  GLB, and commit the GLBs you rebuilt. Keep an eye on their size: island.glb is already about 11 MB.
- ElevenLabs for sound design, music and voices: add entries to SOUNDS in tools/sounds/generate.ts
  (\`music: true\` composes with the music model) and run \`just sounds <name>\`. It reads elevenlabs.apiKey from
  config.yaml; never print the key. Each one costs credits: at most 3 generations per session, at most one of them
  music, and never regenerate a sound you didn't add in this loop (Kees's lines included). Listen with your eyes:
  check the file's length and loudness with ffprobe/ffmpeg, and if the prompt clearly missed, adjust it once.
- WebAudio, navigator.vibrate and tilt (river/tilt.ts) for touch, always off when the site's sound is.
- Anything else you can make with: shaders, procedural generation, real data, Python drawings, ffmpeg, a tool you
  write or install yourself for one thing. If the best way to make something needs a new medium, build it.
- Subagents: use them for the heavy jobs (a Blender model, a big module, browser verification) to keep your own
  context small. Brief each one with exactly what it needs, and wait for every one to return before you finish.

Verify before committing:
- \`npx tsc --noEmit\` (one old error in astro.config.mjs is expected) and \`npm run build\`.
- In a browser: start \`npx astro dev --port $PORT\` in the worktree in the background, and stop it when you're done.
  Drive it with Playwright (headless Chromium, installed under $RUNS/playwright; if it's missing, run
  \`npm i --prefix $RUNS/playwright playwright && npx --prefix $RUNS/playwright playwright install chromium\`).
  Use the preview query params (AGENTS.md) to reach the moment you built for. Screenshot what you built at desktop
  and phone size, at normal zoom and zoomed in, then look at the screenshots yourself. Iterate until it reads well
  in the pixel renderer. Save the screenshots under $LOGDIR/shots/<date>-<slug>/. Check that the browser console
  shows no errors from your code. Leave localStorage as you found it.

Then:
- Update the ledger: a Done entry (newest first: what, where, the commit), project progress, ideas struck or
  added, known issues, questions.
- Commit everything you changed, in one commit, titled 'Island: <one plain sentence about what's new>' (or
  'Low Water: ...' for Low Water), in the repo's usual style, ending with: Co-Authored-By: Claude <noreply@anthropic.com>
- If something fails twice and you can't fix it, revert your unit (\`git restore\`, and \`git clean\` on only your
  own new files), write it into the ledger's Known issues, commit the ledger, and answer STUCK.

A human may watch your text live, one short line at a time (under 150 chars each):
- once you've chosen: 'Working on: <the addition, project step or polish pass>'
- when something changes the plan: 'Finding: <one line>'
- just before the end: 'Summary: <what's new on the island>'
No other long prose.
End your reply with exactly one line: BUILT <one line> | POLISHED <one line> | STUCK <reason>"

GOAL="/goal Your latest message's last line is exactly one of: BUILT <something>, POLISHED <something>, or STUCK <reason>."
MILESTONE='select(.type == "assistant") | .message.content[]? | select(.type == "text") |
  .text | split("\n")[] | select(test("^(Working on|Finding|Summary):")) |
  "[" + (now | strflocaltime("%Y-%m-%d %H:%M:%S")) + "]    " + .[0:200]'

log "island-loop started (model $MODEL, config ${CLAUDE_CONFIG_DIR:-~/.claude}, worktree $WT)"
[ -d "$MEMORY" ] || log "no memory at $MEMORY — sessions will only have the repo to go on"
N=0
STUCK=0
while [ ! -e "$STOP" ]; do
  N=$((N + 1))

  # Start every session from main as it is now, so your own commits on main are always under the island.
  if ! git -C "$WT" diff --quiet || ! git -C "$WT" diff --cached --quiet || [ -n "$(git -C "$WT" ls-files --others --exclude-standard)" ]; then
    log "the worktree has uncommitted changes from a dead session — stashing them as island-dead-$N"
    git -C "$WT" stash push -u -m "island-dead-$N" >/dev/null
  fi
  if ! git -C "$WT" rebase main >/dev/null 2>&1; then
    git -C "$WT" rebase --abort 2>/dev/null
    log "couldn't rebase island onto main (a conflict) — resolve it in $WT, then start again"
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
      [ "$STUCK" -ge 3 ] && { log "stuck three times running — stopping; see tools/island/ledger.md in $WT"; exit 1; }
      log "stuck — the next session will choose something else" ;;
    BUILT*|POLISHED*) STUCK=0; log "on the island now: $(git -C "$WT" log -1 --format=%s)" ;;
    *) log "no protocol line — waiting 5 min before the next session"; sleep 300 ;;
  esac
done
rm -f "$STOP"
log "island-loop stopped"
