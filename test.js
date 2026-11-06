// Real-click headless test for Shadow Sneak: Silent Strike.
// Usage: node test.js <file-url> <outdir> [START_LEVEL]
// Drives the game only through real DOM clicks / canvas pointer clicks.
// Resume: START_LEVEL>1 jumps in via the ?level=N deep link and plays from there.
// Progress is written to <outdir>/progress.json after every cleared level so a
// wrapper can relaunch at the next uncompleted level if the browser dies.
const { chromium } = require('playwright-core');
const fs = require('fs');
const [url, outdir] = process.argv.slice(2);
const START_LEVEL = parseInt(process.env.START_LEVEL || '1', 10);
fs.mkdirSync(outdir, { recursive: true });
const results = [];
const cleared = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '')); }
function saveProgress(next) { try { fs.writeFileSync(outdir + '/progress.json', JSON.stringify({ nextLevel: next, cleared })); } catch (e) {} }
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--hatch-webgl-allowed-domains-file=/home/hatch/workspace/tools/pw-shot/webgl-policy.txt', '--hatch-webgl-allowed-domains-sha256=dc8a0e5eec744f6590a4c1889139c00568ffedc3eced6d0a1a5127e35f9ccd16'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });
  const state = () => page.evaluate(() => window.__shadowSneak ? window.__shadowSneak() : null);
  const shot = async (f) => { try { await page.screenshot({ path: f }); } catch (e) { console.log('SHOT-SKIP ' + f + ' — ' + e.message.split('\n')[0]); } };
  const clickCanvas = async (gx, gy) => {
    let box = await page.locator('#game').boundingBox();
    if (!box) { await page.waitForTimeout(800); box = await page.locator('#game').boundingBox(); }
    if (!box) throw new Error('canvas boundingBox null (page gone?)');
    await page.mouse.click(box.x + gx / 480 * box.width, box.y + gy / 800 * box.height);
  };
  // Complete one level by real clicks: stalk the boss from behind, strike, then walk to the exit.
  async function playLevel(n) {
    let lastPos = null, stuck = 0;
    for (let i = 0; i < 200; i++) {
      let s = await state();
      if (!s || !s.player) return { ok: false, why: 'no hook/state' };
      if (s.screen === 'clear' || s.screen === 'win') return { ok: true, screen: s.screen, score: s.score };
      if (s.screen === 'gameover') { await page.click('#btn-retry'); await page.waitForTimeout(400); lastPos = null; stuck = 0; continue; }
      if (s.screen !== 'playing') return { ok: false, why: 'screen=' + s.screen };
      // Stuck detection: barely moved while chasing -> flank to a side point so
      // the boss walks on and the approach angle changes.
      if (lastPos && Math.hypot(s.player.x - lastPos.x, s.player.y - lastPos.y) < 12) stuck++; else stuck = 0;
      lastPos = { x: s.player.x, y: s.player.y };
      // If the alarm is building, break off: pop smoke if we have it, else
      // retreat toward spawn and let the meter drain before re-engaging.
      if (s.detection > 0.4 && s.smokeLeft > 0) { await page.click('#btn-smoke'); await page.waitForTimeout(300); continue; }
      if (s.detection > 0.5) { await clickCanvas(70, 680); await page.waitForTimeout(900); continue; }
      if (s.boss && s.boss.alive) {
        // Strike ANY strikeable target (clears guards blocking the boss too).
        // Tap the target on the canvas: the button can disable mid-race as the
        // target walks out of range, but a canvas tap strikes directly.
        if (s.strikeTarget) { await clickCanvas(s.strikeTarget.x, s.strikeTarget.y); await page.waitForTimeout(350); continue; }
        if (stuck >= 5) {
          const px = s.boss.x + Math.cos(s.boss.dir + Math.PI / 2) * 70, py = s.boss.y + Math.sin(s.boss.dir + Math.PI / 2) * 70;
          await clickCanvas(px, py); stuck = 0; await page.waitForTimeout(600); continue;
        }
        const bx = s.boss.x - Math.cos(s.boss.dir) * 34, by = s.boss.y - Math.sin(s.boss.dir) * 34;
        await clickCanvas(bx, by);
        await page.waitForTimeout(250);
      } else if (s.exit && s.exit.open) {
        await clickCanvas(s.exit.x, s.exit.y);
        await page.waitForTimeout(400);
      } else { await page.waitForTimeout(300); }
    }
    const s = await state();
    return { ok: false, why: 'timeout at level ' + n + ' screen=' + (s && s.screen) + ' bossAlive=' + (s && s.boss && s.boss.alive) + ' lives=' + (s && s.lives) };
  }

  const gotoUrl = START_LEVEL > 1 ? url + '?level=' + START_LEVEL : url;
  await page.goto(gotoUrl, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  let s = await state();

  if (START_LEVEL === 1) {
    check('loads, hook present, menu screen', s && s.screen === 'menu', JSON.stringify(s && { screen: s.screen, maxUnlocked: s.maxUnlocked }));
    await shot(outdir + '/01-menu.png');

    await page.click('#btn-howto'); await page.waitForTimeout(300);
    s = await state(); check('how-to opens', s.screen === 'howto', s.screen);
    await page.click('#btn-howto-back'); await page.waitForTimeout(300);
    s = await state(); check('how-to back -> menu', s.screen === 'menu', s.screen);

    await page.click('#btn-start'); await page.waitForTimeout(500);
    s = await state();
    check('start -> playing level 1', s && s.screen === 'playing' && s.level === 1 && s.lives === 3 && s.guards.length >= 2 && s.boss && s.boss.alive, JSON.stringify(s && { level: s.level, lives: s.lives, guards: s.guards.length, boss: !!s.boss }));
    await shot(outdir + '/02-level1.png');

    const p0 = { x: s.player.x, y: s.player.y };
    await clickCanvas(240, 400); await page.waitForTimeout(2000);
    s = await state();
    check('click-to-move moves player', s && Math.hypot(s.player.x - p0.x, s.player.y - p0.y) > 10, 'from ' + JSON.stringify(p0) + ' to ' + JSON.stringify(s.player));

    await page.click('#btn-pause'); await page.waitForTimeout(250);
    s = await state(); check('pause -> paused', s.screen === 'paused', s.screen);
    await shot(outdir + '/03-paused.png');
    await page.click('#btn-resume'); await page.waitForTimeout(250);
    s = await state(); check('resume -> playing', s.screen === 'playing', s.screen);
    await page.click('#btn-mute'); s = await state(); check('mute toggles on', s.muted === true, 'muted=' + s.muted);
    await page.click('#btn-mute'); s = await state(); check('mute toggles off', s.muted === false, 'muted=' + s.muted);

    let r = await playLevel(1);
    await page.waitForTimeout(400); s = await state();
    check('level 1 completes via boss strike + exit -> clear screen', r.ok && s.screen === 'clear', JSON.stringify({ r, screen: s && s.screen, score: s && s.score }));
    await shot(outdir + '/04-clear.png');
    if (r.ok && s.screen === 'clear') { cleared.push(1); saveProgress(2); }
    if (!r.ok) { check('no console/page errors during whole run', errors.length === 0, errors.slice(0, 5).join(' | ')); await browser.close(); process.exit(1); }

    await page.click('#btn-next'); await page.waitForTimeout(400);
    s = await state(); check('next -> playing level 2', s && s.screen === 'playing' && s.level === 2, JSON.stringify(s && { level: s.level }));
    check('smoke locked on level 2 (0 left)', s.smokeLeft === 0, 'smokeLeft=' + s.smokeLeft);
  } else {
    check('resume via ?level=' + START_LEVEL + ' -> playing', s && s.screen === 'playing' && s.level === START_LEVEL, JSON.stringify(s && { screen: s.screen, level: s.level }));
  }

  // Full playthrough from the current level to 20 with real clicks
  const firstLvl = START_LEVEL === 1 ? 2 : START_LEVEL;
  let won = false, failAt = null;
  for (let lvl = firstLvl; lvl <= 20; lvl++) {
    s = await state();
    if (!s || s.screen !== 'playing' || s.level !== lvl) { failAt = 'level ' + lvl + ' unexpected state ' + JSON.stringify(s && { screen: s.screen, level: s.level }); break; }
    if (lvl === 3) check('smoke unlocked on level 3', s.smokeLeft >= 2, 'smokeLeft=' + s.smokeLeft);
    if (lvl === 10) await shot(outdir + '/05-level10.png');
    if (lvl === 20) await shot(outdir + '/06-level20.png');
    const r = await playLevel(lvl);
    await page.waitForTimeout(400); s = await state();
    if (lvl < 20) {
      if (!r.ok || s.screen !== 'clear') { failAt = 'level ' + lvl + ' did not clear: ' + JSON.stringify({ r, screen: s && s.screen }); break; }
      cleared.push(lvl); saveProgress(lvl + 1);
      await page.click('#btn-next'); await page.waitForTimeout(400);
    } else {
      if (s.screen === 'win') { won = true; cleared.push(lvl); saveProgress(21); } else failAt = 'level 20 did not win: ' + JSON.stringify({ r, screen: s && s.screen });
    }
  }
  check('full playthrough levels ' + firstLvl + '..20 -> win screen', won && !failAt, failAt || 'win reached');
  if (won) await shot(outdir + '/07-win.png');

  check('no console/page errors during whole run', errors.length === 0, errors.slice(0, 5).join(' | '));
  const fails = results.filter(x => !x.ok).length;
  console.log('\n' + (results.length - fails) + '/' + results.length + ' checks passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e.stack || e.message); process.exit(2); });
