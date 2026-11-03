#!/usr/bin/env node
// End-to-end test: drives web/index.html in headless Chromium against
// scripts/mock_robot.py and checks the commands the robot receives.
//
//   node scripts/e2e_dashboard.js [--screenshots DIR]
//
// Needs Node 18+, Python 3 and Playwright (npm i playwright && npx playwright install chromium).
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const shotDir = (() => {
  const i = process.argv.indexOf('--screenshots');
  return i > 0 ? path.resolve(process.argv[i + 1]) : null;
})();

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ': ' + detail}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function commandsSince(t0) {
  const res = await fetch(`${BASE}/debug/log`);
  const log = await res.json();
  return log.filter((e) => e.t * 1000 >= t0).map((e) => e.cmd).filter((c) => !c.startsWith('ping'));
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/status`)).ok) return; } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('mock robot did not start');
}

async function holdPointer(page, selector, ms, offset) {
  const box = await page.locator(selector).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  if (offset) await page.mouse.move(cx + offset.x, cy + offset.y, { steps: 5 });
  await sleep(ms);
  await page.mouse.up();
}

(async () => {
  const mock = spawn('python3', [path.join(ROOT, 'scripts', 'mock_robot.py'), '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch();

    // ---------------------------------------------------------- landscape phone
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(`${BASE}/`);

    await page.waitForSelector('#conn.online', { timeout: 5000 });
    check('connects to the robot over WebSocket', true);
    await page.waitForSelector('#video.live', { timeout: 5000 });
    check('shows the MJPEG stream', true);
    await page.waitForFunction(() => /\d+ fps/.test(document.querySelector('#fps').textContent), null, { timeout: 4000 });
    check('shows telemetry (fps)', true);
    await page.waitForFunction(() => /\d+ ms/.test(document.querySelector('#rtt').textContent), null, { timeout: 4000 });
    check('measures round-trip latency', true);

    // Joystick: push straight up for 400 ms, release.
    let t0 = Date.now();
    await holdPointer(page, '#joystick', 400, { x: 0, y: -200 });
    await sleep(150);
    let cmds = await commandsSince(t0);
    const joys = cmds.filter((c) => c.startsWith('joy '));
    check('joystick streams joy commands while held', joys.length >= 5, `${joys.length} joy commands`);
    check('joystick full-forward is "joy 0 100"', joys.includes('joy 0 100'), joys.slice(-3).join(', '));
    check('releasing the joystick sends stop', cmds[cmds.length - 1] === 'stop', cmds.slice(-3).join(', '));

    // Ramp + failsafe visible in the wheel-power bars.
    t0 = Date.now();
    const box = await page.locator('#joystick').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 100, { steps: 4 });
    await page.waitForFunction(() => parseFloat(document.querySelector('#bar-l').style.width) > 20, null, { timeout: 3000 });
    check('wheel-power bars follow robot telemetry', true);
    await page.mouse.up();

    // D-pad: every direction, then the STOP buttons.
    await page.click('[data-mode="dpad"]');
    for (const move of ['forward', 'reverse', 'left', 'right']) {
      t0 = Date.now();
      await holdPointer(page, `[data-move="${move}"]`, 300);
      await sleep(100);
      cmds = await commandsSince(t0);
      const n = cmds.filter((c) => c === `move ${move}`).length;
      check(`D-pad ${move}: repeats "move ${move}" then stops`, n >= 3 && cmds[cmds.length - 1] === 'stop', cmds.join(', '));
    }
    t0 = Date.now();
    await page.locator('#stop').dispatchEvent('pointerdown');
    await sleep(100);
    check('STOP button sends stop', (await commandsSince(t0)).includes('stop'));

    // Keyboard: W + D arcs forward-right.
    t0 = Date.now();
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await sleep(250);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    await sleep(100);
    cmds = await commandsSince(t0);
    check('keyboard W+D sends "joy 50 100"', cmds.includes('joy 50 100'), cmds.join(', '));
    check('keyboard release sends stop', cmds[cmds.length - 1] === 'stop');

    // Speed limit slider and headlight.
    t0 = Date.now();
    await page.locator('#speed').fill('40');
    await sleep(250);
    check('speed slider sends "speed 40"', (await commandsSince(t0)).includes('speed 40'));
    const status = await (await fetch(`${BASE}/status`)).json();
    check('robot applied the new speed limit', status.speed === 40, JSON.stringify(status.speed));
    t0 = Date.now();
    await page.click('#btn-light');
    await sleep(150);
    check('headlight button sends a light command', (await commandsSince(t0)).some((c) => /^light [1-9]/.test(c)));
    check('headlight button shows as on', (await page.getAttribute('#btn-light', 'aria-pressed')) === 'true');

    if (shotDir) {
      fs.mkdirSync(shotDir, { recursive: true });
      await page.click('[data-mode="joystick"]');
      await page.click('#btn-light');
      await sleep(1200);
      await page.screenshot({ path: path.join(shotDir, 'dashboard-landscape.png') });
    }

    // Settings: camera options reach the robot.
    await page.click('#btn-settings');
    t0 = Date.now();
    await page.selectOption('#framesize', 'qvga');
    await page.check('#vflip');
    await sleep(200);
    cmds = await commandsSince(t0);
    check('resolution change sends "cam framesize qvga"', cmds.includes('cam framesize qvga'), cmds.join(', '));
    check('flip sends "cam vflip 1"', cmds.includes('cam vflip 1'), cmds.join(', '));
    await page.click('#close-settings');

    check('no JavaScript errors (landscape)', pageErrors.length === 0, pageErrors.join(' | '));
    await ctx.close();

    // ---------------------------------------------------------- portrait phone, touch
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p2 = await phone.newPage();
    const errors2 = [];
    p2.on('pageerror', (e) => errors2.push(e.message));
    await p2.goto(`${BASE}/`);
    await p2.waitForSelector('#conn.online', { timeout: 5000 });
    await p2.waitForSelector('#video.live', { timeout: 5000 });
    const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check('portrait layout has no horizontal overflow', !overflow);
    const fits = await p2.evaluate(() => {
      const r = document.querySelector('#stop').getBoundingClientRect();
      const j = document.querySelector('#joystick').getBoundingClientRect();
      return r.right <= innerWidth && r.bottom <= innerHeight && j.left >= 0 && j.bottom <= innerHeight;
    });
    check('portrait controls fit on screen', fits);
    if (shotDir) {
      await sleep(1200);
      await p2.screenshot({ path: path.join(shotDir, 'dashboard-portrait.png') });
    }
    check('no JavaScript errors (portrait)', errors2.length === 0, errors2.join(' | '));
    await phone.close();

    // ---------------------------------------------------------- standalone (file://) mode
    const file = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const p3 = await file.newPage();
    await p3.goto('file://' + path.join(ROOT, 'web', 'index.html'));
    await p3.waitForSelector('dialog#settings[open]', { timeout: 3000 });
    check('opened from disk, it asks for the robot address', true);
    await p3.fill('#host', `127.0.0.1:${PORT}`);
    await p3.press('#host', 'Enter');
    await p3.waitForSelector('#conn.online', { timeout: 5000 });
    check('Enter in the address field connects', true);
    await p3.waitForSelector('#video.live', { timeout: 5000 });
    check('standalone mode shows the stream from the robot', true);
    await file.close();
  } catch (e) {
    check('test run', false, e.stack || String(e));
  } finally {
    if (browser) await browser.close();
    mock.kill();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
