/**
 * Minimal Chrome DevTools Protocol driver for local visual checks.
 *   node tools/shot.mjs <out.png> ["<js>"] [waitMs] [url]
 * Launches headless Chrome with WebGL, waits for the app to settle,
 * optionally evaluates JS, then writes a screenshot.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = process.argv[2] || 'shots/shot.png';
const js = process.argv[3] || '';
const waitMs = Number(process.argv[4] || 3000);
const url = process.argv[5] || 'http://localhost:5173/';
const PORT = 9333;

mkdirSync(dirname(out), { recursive: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=./.chrome-profile',
    '--window-size=1600,1000',
    '--hide-scrollbars',
    '--use-angle=metal',
    '--disable-gpu-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

async function waitForChrome() {
  for (let i = 0; i < 80; i++) {
    try {
      const v = await getJSON('/json/version');
      if (v.webSocketDebuggerUrl) return;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error('Chrome did not start');
}

let id = 0;
function makeClient(ws) {
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      console.error('PAGE EXCEPTION:', d.exception?.description || d.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      console.error(
        `PAGE ${msg.params.type.toUpperCase()}:`,
        msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
      );
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
}

try {
  await waitForChrome();
  const targets = await getJSON('/json/list');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', j);
  });
  const send = makeClient(ws);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url });
  await sleep(2600);
  if (js) {
    const res = await send('Runtime.evaluate', {
      expression: js,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      console.error('EVAL ERROR:', res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    } else if (res.result?.value !== undefined) {
      console.log('EVAL:', JSON.stringify(res.result.value));
    }
    await sleep(waitMs);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('WROTE', out);
  ws.close();
} catch (err) {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  await sleep(200);
  chrome.kill('SIGKILL');
}
