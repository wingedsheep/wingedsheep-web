/**
 * Films the autopilot going down the rivers in the game itself: Chrome with no window, the page's
 * clock stepped a frame at a time (so however long the paddler takes to think, the film runs
 * smoothly), a screenshot every frame of film, and ffmpeg to make them a movie.
 *
 *   just record                               every river, seed 1, into recordings/
 *   just record --river black --seed 3        just that one
 *   just record --size 1920x1080 --fps 60
 *   just record --river dawdle --seconds 20   a quick look
 *   just record --url http://localhost:4321   a dev server that's already running (else it starts one)
 *
 * It needs Google Chrome and ffmpeg. The paddler is pilot.ts's, the same as `just autopilot`'s.
 */

import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RIVERS } from '../../src/island/river/rivers';

const args = parse(process.argv.slice(2));
const CHROME = args.chrome ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = args.out ?? 'recordings';
const [W, H] = (args.size ?? '1280x720').split('x').map(Number);
const FPS = Number(args.fps ?? 30);
const SEED = Number(args.seed ?? 1);
const STEP = 1000 / 60; // the game's frame (ms of its clock); every 60/FPS-th one is filmed
/** Once it's down (or swimming), this much more (s) of the take-out. */
const TAIL = 5;

const rivers = args.river ? RIVERS.filter((r) => r.id === args.river) : RIVERS;
if (!rivers.length) {
  console.error(`no river called ${args.river}: ${RIVERS.map((r) => r.id).join(', ')}`);
  process.exit(2);
}

/**
 * In the page before anything else: its clock only moves when we say, a frame at a time. And no
 * hot reloading: whatever's edited while it films, the film goes on with the code it started with.
 */
const CLOCK = `(() => {
  const Socket = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    if (String(protocols).includes('vite-hmr')) return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 0 };
    return new Socket(url, protocols);
  };
  let now = 0;
  const epoch = Date.now();
  let queue = [];
  performance.now = () => now;
  Date.now = () => epoch + now;
  window.requestAnimationFrame = (cb) => (queue.push(cb), queue.length);
  window.cancelAnimationFrame = () => {};
  window.__tick = (n, ms) => {
    for (let i = 0; i < n; i++) {
      now += ms;
      const q = queue;
      queue = [];
      for (const cb of q) cb(now);
    }
  };
})();`;

await main();

async function main() {
  mkdirSync(OUT, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'record-rivers-'));
  const bundle = join(tmp, 'pilot-page.js');
  execFileSync('npx', ['esbuild', 'tools/rivers/pilot-page.ts', '--bundle', '--format=iife', '--log-level=warning', `--outfile=${bundle}`]);
  const pilot = readFileSync(bundle, 'utf8');

  // this project's dev server (Astro runs one at a time: use it if it's up, else start one)
  let server: ChildProcess | undefined;
  let url = args.url;
  if (!url) {
    const status = (() => {
      try {
        return execFileSync('npx', ['astro', 'dev', 'status'], { encoding: 'utf8' });
      } catch (e) {
        return String((e as { stdout?: string }).stdout ?? '');
      }
    })();
    url = status.match(/running at (http:\/\/[^\s"]+)/)?.[1];
    if (!url) {
      url = 'http://localhost:4390';
      server = spawn('npx', ['astro', 'dev', '--port', '4390'], { stdio: 'ignore', detached: true });
    }
    await until(async () => (await fetch(url!).catch(() => null))?.ok ?? false, 120_000, `the dev server (${url})`);
  }
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=9339', `--user-data-dir=${join(tmp, 'chrome')}`, `--window-size=${W},${H}`,
    '--mute-audio', '--no-first-run', '--no-default-browser-check', '--enable-gpu', '--ignore-gpu-blocklist', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    await until(async () => (await fetch('http://127.0.0.1:9339/json/version').catch(() => null))?.ok ?? false, 30_000, 'Chrome');
    for (const river of rivers) await film(url, river.id, pilot);
  } finally {
    chrome.kill();
    if (server?.pid) process.kill(-server.pid);
  }
}

async function film(base: string, id: string, pilot: string) {
  const target = await (await fetch('http://127.0.0.1:9339/json/new?about:blank', { method: 'PUT' })).json() as { id: string; webSocketDebuggerUrl: string };
  const page = await connect(target.webSocketDebuggerUrl);
  const js = async <T>(expression: string): Promise<T> => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }) as { result: { value: T }; exceptionDetails?: { text: string; exception?: { description?: string } } };
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: pilot });
  await page.send('Page.navigate', { url: `${base}/?river=${id}&seed=${SEED}#river` });

  // the island loads, then the river (a frame at a time, and a moment of real time for the models to come in)
  process.stdout.write(`${id}: loading`);
  await until(async () => {
    await js('window.__tick?.(10, 16.67)');
    return js<boolean>('!!window.river');
  }, 180_000, 'the river');
  await js('window.__tick(30, 16.67)');
  const { planned } = await js<{ planned: boolean }>('window.autopilot(window.river)');
  if (!planned) console.log(' (no line all the way down: paddling anyway)');

  const file = join(OUT, `${id}-seed${SEED}.mp4`);
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const per = Math.max(1, Math.round(60 / FPS));
  let frames = 0;
  let tail = -1;
  const limit = 60 * Number(args.seconds ?? 600); // (ten minutes of river is more than any of them; --seconds for a short one)
  for (let f = 0; f < limit; f += per) {
    await js(`window.__tick(${per}, ${STEP})`);
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }) as { data: string };
    if (!ffmpeg.stdin!.write(Buffer.from(shot.data, 'base64'))) await new Promise((r) => ffmpeg.stdin!.once('drain', r));
    frames++;
    if (frames % (FPS * 10) === 0) {
      const at = await js<{ m: number; state: string }>('({ m: Math.round(window.river.kayak.s - window.river.start), state: window.river.state })');
      process.stdout.write(`\r${id}: ${at.m} m, ${Math.round(frames / FPS)} s of film   `);
    }
    if (tail < 0 && (await js<string>('window.river.state')) === 'over') tail = frames;
    if (tail >= 0 && frames - tail > TAIL * FPS) break;
  }
  ffmpeg.stdin!.end();
  await new Promise((r) => ffmpeg.on('close', r));
  const t = await js<{ time: number; flips: number; finished: boolean }>('window.river.tally').catch(() => ({ time: 0, flips: 0, finished: false }));
  console.log(`\r${id}: ${t.finished ? `down in ${t.time.toFixed(0)} s` : 'didn’t make it down'}${t.flips ? `, ${t.flips} capsize${t.flips > 1 ? 's' : ''}` : ''}: ${file}          `);
  page.close();
  await fetch(`http://127.0.0.1:9339/json/close/${target.id}`).catch(() => {});
}

// --- the DevTools protocol, just enough of it --------------------------------------------

async function connect(ws: string) {
  const sock = new WebSocket(ws);
  await new Promise((r, f) => ((sock.onopen = r), (sock.onerror = f)));
  let id = 0;
  const waiting = new Map<number, { ok: (v: unknown) => void; fail: (e: Error) => void }>();
  sock.onmessage = (e) => {
    const m = JSON.parse(String(e.data)) as { id?: number; result?: unknown; error?: { message: string } };
    const w = m.id !== undefined ? waiting.get(m.id) : undefined;
    if (!w) return;
    waiting.delete(m.id!);
    if (m.error) w.fail(new Error(m.error.message));
    else w.ok(m.result);
  };
  return {
    send(method: string, params: object = {}) {
      return new Promise<unknown>((ok, fail) => {
        waiting.set(++id, { ok, fail });
        sock.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => sock.close(),
  };
}

// --- odds and ends ----------------------------------------------------------------------

async function until(test: () => Promise<boolean>, ms: number, what: string) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await test()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`gave up waiting for ${what}`);
}

function parse(argv: string[]) {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--(\w+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[2] !== undefined) out[m[1]] = m[2];
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[m[1]] = argv[++i];
    else out[m[1]] = '1';
  }
  return out;
}
