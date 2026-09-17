const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hudScore = document.querySelector('.hud-score');
const hudTime = document.querySelector('.hud-time');
const gameOverScreen = document.getElementById('gameOverScreen');
const goScore = document.getElementById('goScore');
const goTime = document.getElementById('goTime');
const goRestart = document.getElementById('goRestart');
const goBest = document.getElementById('goBest');
const goHistory = document.getElementById('goHistory');
const footerBest = document.getElementById('footerBest');
const hudBest = document.getElementById('hudBest');
const newBestBadge = document.getElementById('newBestBadge');
const speedSelect = document.getElementById('speedSelect');
const difficultySelect = document.getElementById('difficultySelect');

// ---- SPEED TIERS ----
const SPEEDS = {
  low: { label: 'LOW', acceleration: 0.25, baseMaxVel: 5.0, capMaxVel: 6.5, baseFriction: 0.990, ramp: 0.07 },
  medium: { label: 'MEDIUM', acceleration: 0.35, baseMaxVel: 7.0, capMaxVel: 9.0, baseFriction: 0.985, ramp: 0.10 },
  high: { label: 'HIGH', acceleration: 0.45, baseMaxVel: 8.5, capMaxVel: 11.0, baseFriction: 0.982, ramp: 0.15 },
  extreme: { label: 'EXTREME', acceleration: 0.55, baseMaxVel: 10.0, capMaxVel: 13.0, baseFriction: 0.978, ramp: 0.20 }
};
const SPEED_KEY = 'zevli:speed';

function validSpeed(s) {
  return Object.prototype.hasOwnProperty.call(SPEEDS, s) ? s : 'medium';
}

function loadSpeed() {
  try {
    const raw = safeGet(SPEED_KEY);
    return validSpeed(String(raw || '').toLowerCase());
  } catch (e) {
    return 'medium';
  }
}

let currentSpeed = loadSpeed();
let isNewBest = false;

// ---- BOX DIFFICULTY: 1 big box on easy, 2 medium (rect + square),
// 3 small on high, 4 small on extreme — playable, corridors open ----
const DIFFICULTY = {
  easy:    { label: 'EASY',    count: 1, size: 1.5,  gap: 60, shapes: ['E'] },
  medium:  { label: 'MEDIUM',  count: 2, size: 1.05, gap: 55, shapes: ['D', 'E'] },
  high:    { label: 'HIGH',    count: 3, size: 0.85, gap: 48, shapes: ['D', 'E'] },
  extreme: { label: 'EXTREME', count: 4, size: 0.7,  gap: 42, shapes: ['D', 'E'] }
};
const DIFF_KEY = 'zevli:difficulty';

function validDifficulty(d) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTY, d) ? d : 'medium';
}

function loadDifficulty() {
  try {
    return validDifficulty(String(safeGet(DIFF_KEY) || '').toLowerCase());
  } catch (e) {
    return 'medium';
  }
}

let currentDifficulty = loadDifficulty();

// ---- LOCAL HISTORY + SCORES (localStorage only, no backend) ----
const BEST_KEY = 'zevli:best'; // legacy single best, migrated to medium
const HISTORY_KEY = 'zevli:history';
const HISTORY_MAX = 20;

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    // private mode / quota / unavailable: keep game running in-memory
  }
}

function bestKey(speed) {
  return 'zevli:best:' + speed;
}

function defaultBest() {
  return { score: 0, time: 0, date: null };
}

function sanitizeBest(b) {
  if (typeof b !== 'object' || b === null) return defaultBest();
  return {
    score: Number.isFinite(+b.score) ? Math.max(0, Math.floor(+b.score)) : 0,
    time: Number.isFinite(+b.time) ? Math.max(0, +b.time) : 0,
    date: typeof b.date === 'string' ? b.date : null
  };
}

function loadBestFor(speed) {
  try {
    const raw = safeGet(bestKey(speed));
    if (!raw) return defaultBest();
    return sanitizeBest(JSON.parse(raw));
  } catch (e) {
    return defaultBest();
  }
}

function saveBestFor(speed, b) {
  safeSet(bestKey(speed), JSON.stringify(b));
}

function migrateLegacyBest() {
  try {
    if (safeGet(bestKey('medium')) !== null) return;
    const legacy = safeGet(BEST_KEY);
    if (!legacy) return;
    saveBestFor('medium', sanitizeBest(JSON.parse(legacy)));
  } catch (e) {
    // corrupt legacy: ignore, medium keeps defaults
  }
}

function loadHistory() {
  try {
    const raw = safeGet(HISTORY_KEY);
    if (!raw) return [];
    const h = JSON.parse(raw);
    if (!Array.isArray(h)) return [];
    return h
      .filter((r) => r && typeof r === 'object')
      .map((r) => ({
        score: Number.isFinite(+r.score) ? Math.max(0, Math.floor(+r.score)) : 0,
        time: Number.isFinite(+r.time) ? Math.max(0, +r.time) : 0,
        date: typeof r.date === 'string' ? r.date : null,
        speed: validSpeed(String(r.speed || 'medium').toLowerCase()),
        difficulty: validDifficulty(String(r.difficulty || 'medium').toLowerCase())
      }))
      .slice(0, HISTORY_MAX);
  } catch (e) {
    return [];
  }
}

function saveHistory(h) {
  safeSet(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
}

migrateLegacyBest();
let bestBySpeed = {
  low: loadBestFor('low'),
  medium: loadBestFor('medium'),
  high: loadBestFor('high'),
  extreme: loadBestFor('extreme')
};
let best = bestBySpeed[currentSpeed];
let runHistory = loadHistory();

function formatRunDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

function renderFooterBest() {
  if (footerBest) footerBest.textContent = SPEEDS[currentSpeed].label + ' BEST: ' + best.score;
}

function renderSpeedUI() {
  if (!speedSelect) return;
  const buttons = speedSelect.querySelectorAll('button[data-speed]');
  buttons.forEach((btn) => {
    if (btn.dataset.speed === currentSpeed) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function renderDifficultyUI() {
  if (!difficultySelect) return;
  const buttons = difficultySelect.querySelectorAll('button[data-difficulty]');
  buttons.forEach((btn) => {
    if (btn.dataset.difficulty === currentDifficulty) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function renderGameOverHistory() {
  const label = SPEEDS[currentSpeed].label;
  if (goBest) {
    const d = formatRunDate(best.date);
    goBest.textContent = label + ' BEST \u2014 SCORE ' + best.score +
      ' / TIME ' + Number(best.time).toFixed(1) + 's' +
      (d ? ' \u2014 ' + d.toUpperCase() : '');
  }
  if (!goHistory) return;
  goHistory.innerHTML = '';
  const last5 = runHistory.filter((r) => r.speed === currentSpeed).slice(0, 5);
  if (last5.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'NO RUNS YET';
    goHistory.appendChild(li);
    return;
  }
  for (const r of last5) {
    const li = document.createElement('li');
    const d = formatRunDate(r.date);
    li.textContent = '[' + SPEEDS[r.speed].label + '] ' + r.score + ' - ' +
      Number(r.time).toFixed(1) + 's' + (d ? ' - ' + d : '');
    goHistory.appendChild(li);
  }
}

function applySpeedPhysics() {
  const cfg = SPEEDS[currentSpeed];
  physics.acceleration = cfg.acceleration;
  physics.maxVelocity = cfg.baseMaxVel;
  physics.friction = cfg.baseFriction;
  physics.bounce = 0.5;
  physics.playerRadius = 14;
  physics.targetRadius = 8;
}

// ---- DEVICE (mobile vs desktop) ----
const isTouchDevice =
  (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
  'ontouchstart' in window ||
  (navigator.maxTouchPoints > 0);
if (isTouchDevice) {
  document.body.classList.add('is-touch');
  if (goRestart) goRestart.textContent = 'TAP TO TRY AGAIN';
}

const dpr = window.devicePixelRatio || 1;
let logicalW = 800;
let logicalH = 600;
let canvasSize = 800;

const STATES = { PLAYING: 'playing', OVER: 'over' };
let state = STATES.OVER;

let player = null;
let arena = null;
let target = null;
let obstacles = [];
let particles = [];
let score = 0;
let elapsedTime = 0;
let difficulty = 1;
let lastTime = 0;
let running = false;

const keys = {};
let touchDirection = null;

// ---- PHYSICS TUNING ----
let physics = {
  friction: 0.985,
  acceleration: 0.35,
  bounce: 0.5,
  maxVelocity: 7,
  playerRadius: 14,
  targetRadius: 8,
  obstacleRadius: 0
};

// ---- INPUT ----
document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (e.key === ' ') {
    e.preventDefault();
    restartGame();
  }
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

// Canvas taps only restart — steering lives on the bottom joystick.
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (state === STATES.OVER) restartGame();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

// ---- BOTTOM JOYSTICK (analog, butter-smooth, 1:1 with player) ----
const joystickBase = document.getElementById('joystickBase');
const joystickKnob = document.getElementById('joystickKnob');
const joystickZone = document.getElementById('joystick');
const JOY_RADIUS = 52;
const JOY_DEADZONE = 0.08;
const JOY_CURVE = 1.4;
const JOY_SMOOTH = 0.35;
const JOY_KNOB_LERP = 0.55;
const JOY_RELEASE_DECAY = 0.5;
const JOY_EXTENDED = 40;
let joyTouchId = null;
let joyActive = false;
let joyIsMouse = false;
let joyOriginX = 0;
let joyOriginY = 0;
// Analog target (-1..1, length = magnitude 0..1) + knob target (px)
let joyTargetX = 0;
let joyTargetY = 0;
let joyTargetDX = 0;
let joyTargetDY = 0;
// Rendered knob pos (lerped in loop for 60fps) + smoothed analog
let joyKnobX = 0;
let joyKnobY = 0;
let smoothX = 0;
let smoothY = 0;
let joyMag = 0;
let joyVibrated = false;

function joySetKnob(dx, dy) {
  if (!joystickKnob) return;
  joystickKnob.style.transform =
    'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
}

function joySetActive(on) {
  if (!joystickBase) return;
  joystickBase.classList.toggle('active', !!on);
  if (joystickKnob) joystickKnob.classList.toggle('idle', !on);
}

function joyPowerCurve(dist01) {
  if (dist01 <= JOY_DEADZONE) return 0;
  const t = (dist01 - JOY_DEADZONE) / (1 - JOY_DEADZONE);
  return Math.pow(t, JOY_CURVE);
}

function joyBaseCenter() {
  if (!joystickBase) return { x: 0, y: 0, radius: 65 };
  const r = joystickBase.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.width / 2 };
}

function joyReset() {
  joyTouchId = null;
  joyActive = false;
  joyIsMouse = false;
  joyTargetX = 0;
  joyTargetY = 0;
  joyTargetDX = 0;
  joyTargetDY = 0;
  joyMag = 0;
  joyVibrated = false;
  // Targets go to 0 — smoothing + knob spring back in loop (fast decay).
  // touchDirection clears once smoothing decays (see joyTick, no drift).
  joySetActive(false);
}

function joyStart(clientX, clientY, id, isMouse) {
  if (joyActive) return;
  joyActive = true;
  joyIsMouse = !!isMouse;
  joyTouchId = id;
  // Floating origin: landing point becomes center, clamped to base circle
  // so taps anywhere in the 40px extended area grab without jumping.
  const c = joyBaseCenter();
  const ox = clientX - c.x;
  const oy = clientY - c.y;
  const olen = Math.hypot(ox, oy);
  if (olen > c.radius) {
    joyOriginX = c.x + (ox / (olen || 1)) * c.radius;
    joyOriginY = c.y + (oy / (olen || 1)) * c.radius;
  } else {
    joyOriginX = clientX;
    joyOriginY = clientY;
  }
  joyTargetX = 0;
  joyTargetY = 0;
  joyTargetDX = 0;
  joyTargetDY = 0;
  joyMag = 0;
  joyVibrated = false;
  joySetActive(true);
}

function joyCompute(clientX, clientY) {
  let dx = clientX - joyOriginX;
  let dy = clientY - joyOriginY;
  const len = Math.hypot(dx, dy);
  if (len > JOY_RADIUS) { dx = (dx / len) * JOY_RADIUS; dy = (dy / len) * JOY_RADIUS; }
  const dist01 = Math.min(1, Math.hypot(dx, dy) / JOY_RADIUS);
  // Dead zone 0.08 + smooth power curve 1.4 — no hard jump at edge, no drift.
  const mag = joyPowerCurve(dist01);
  if (mag <= 0 || Math.hypot(dx, dy) < 1) {
    joyTargetX = 0;
    joyTargetY = 0;
    joyTargetDX = 0;
    joyTargetDY = 0;
    joyMag = 0;
    touchDirection = null;
    return;
  }
  const n = Math.hypot(dx, dy) || 1;
  const dirX = dx / n;
  const dirY = dy / n;
  // Normalized direction + magnitude 0..1. Knob follows finger 1:1 (raw px),
  // analog target carries the curved magnitude for precise low-speed control.
  joyTargetDX = dx;
  joyTargetDY = dy;
  joyTargetX = dirX * mag;
  joyTargetY = dirY * mag;
  joyMag = mag;
  touchDirection = { x: dirX, y: dirY, mag: mag, ax: joyTargetX, ay: joyTargetY };
  // Haptic tick at max deflection only (once per push).
  if (mag >= 0.98 && !joyVibrated) {
    joyVibrated = true;
    try {
      if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(5);
    } catch (e) { /* vibrate unavailable */ }
  } else if (mag < 0.9) {
    joyVibrated = false;
  }
}

function joyHandle(e) {
  if (!joyActive || !joystickBase) return;
  const touches = e.changedTouches || e.touches;
  if (!touches) return;
  let t = null;
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === joyTouchId) { t = touches[i]; break; }
  }
  if (!t) return;
  joyCompute(t.clientX, t.clientY);
}

// Per-frame: low-pass filter + 60fps knob lerp (frame-rate independent).
function joyTick(dt) {
  const dtN = Math.min(32, Math.max(0.1, dt)) / 16.666;
  const k = 1 - Math.pow(1 - JOY_SMOOTH, dtN);
  const kRel = 1 - Math.pow(1 - JOY_RELEASE_DECAY, dtN);
  const kKnob = 1 - Math.pow(1 - JOY_KNOB_LERP, dtN);
  const kf = joyActive ? k : kRel;
  // Butter-smooth low-pass: small tilt stays precise, full tilt stays fast.
  smoothX += (joyTargetX - smoothX) * kf;
  smoothY += (joyTargetY - smoothY) * kf;
  // Spring back with fast decay — snap exactly to 0 to kill drift.
  if (!joyActive) {
    if (Math.hypot(smoothX, smoothY) < 0.002) { smoothX = 0; smoothY = 0; }
    if (Math.hypot(joyKnobX, joyKnobY) < 0.15 &&
        Math.hypot(joyTargetDX, joyTargetDY) === 0) { joyKnobX = 0; joyKnobY = 0; }
  }
  // 60fps knob animation — follows finger with <16ms feel, no touchmove lag.
  joyKnobX += (joyTargetDX - joyKnobX) * kKnob;
  joyKnobY += (joyTargetDY - joyKnobY) * kKnob;
  if (Math.hypot(joyKnobX - joyTargetDX, joyKnobY - joyTargetDY) < 0.05) {
    joyKnobX = joyTargetDX;
    joyKnobY = joyTargetDY;
  }
  joySetKnob(joyKnobX.toFixed(2), joyKnobY.toFixed(2));
  // Mirror smoothed analog to the touchDirection global (no double-normalize
  // downstream — vector length already IS the magnitude 0..1).
  const sm = Math.hypot(smoothX, smoothY);
  if (sm > 0.002) {
    touchDirection = {
      x: smoothX / sm,
      y: smoothY / sm,
      mag: Math.min(1, sm),
      ax: smoothX,
      ay: smoothY
    };
  } else if (!joyActive) {
    touchDirection = null;
    smoothX = 0;
    smoothY = 0;
  }
}

if (joystickZone || joystickBase) {
  const zone = joystickZone || joystickBase;
  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state === STATES.OVER) { restartGame(); return; }
    const touches = e.changedTouches || e.touches;
    if (!touches || touches.length === 0 || joyActive) return;
    // Track first new touch id correctly for multi-touch (ignore extras).
    const t = touches[0];
    joyStart(t.clientX, t.clientY, t.identifier, false);
    joyCompute(t.clientX, t.clientY);
  }, { passive: false });

  zone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    joyHandle(e);
  }, { passive: false });

  const joyEnd = (e) => {
    if (e) e.preventDefault();
    const touches = e && e.changedTouches;
    if (touches && joyTouchId !== null) {
      let ended = false;
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === joyTouchId) { ended = true; break; }
      }
      if (!ended) {
        if (e.touches && e.touches.length === 0) joyReset();
        return;
      }
    }
    joyReset();
  };
  zone.addEventListener('touchend', joyEnd, { passive: false });
  zone.addEventListener('touchcancel', joyEnd, { passive: false });

  // Mouse fallback for desktop testing (same analog path, no drift/jump).
  zone.addEventListener('mousedown', (e) => {
    if (joyActive) return;
    if (state === STATES.OVER) { restartGame(); return; }
    e.preventDefault();
    joyStart(e.clientX, e.clientY, 'mouse', true);
    joyCompute(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => {
    if (!joyActive || !joyIsMouse) return;
    e.preventDefault();
    joyCompute(e.clientX, e.clientY);
  }, { passive: false });
  window.addEventListener('mouseup', (e) => {
    if (!joyActive || !joyIsMouse) return;
    joyReset();
  });
  if (joystickKnob) joystickKnob.classList.add('idle');
}

canvas.addEventListener('click', () => {
  if (state === STATES.OVER) restartGame();
});

document.querySelector('.btn-play').addEventListener('click', (e) => {
  e.preventDefault();
  restartGame();
  document.querySelector('.game-wrapper').scrollIntoView({ behavior: 'smooth' });
});

if (speedSelect) {
  speedSelect.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-speed]');
    if (!btn) return;
    const next = validSpeed(String(btn.dataset.speed).toLowerCase());
    if (next === currentSpeed) return;
    currentSpeed = next;
    best = bestBySpeed[currentSpeed];
    safeSet(SPEED_KEY, currentSpeed);
    renderSpeedUI();
    restartGame();
  });
}

if (difficultySelect) {
  difficultySelect.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-difficulty]');
    if (!btn) return;
    const next = validDifficulty(String(btn.dataset.difficulty).toLowerCase());
    if (next === currentDifficulty) return;
    currentDifficulty = next;
    safeSet(DIFF_KEY, currentDifficulty);
    renderDifficultyUI();
    restartGame();
  });
}

// ---- CANVAS RESIZE ----
function syncArenaToCanvas() {
  if (!arena) return;
  const margin = 40;
  arena.bounds = {
    x: margin,
    y: margin,
    w: canvasSize - margin * 2,
    h: canvasSize - margin * 2
  };
  const b = arena.bounds;
  // Clamp obstacles back inside on window shrink (instead of deleting
  // them, which thinned higher difficulties down to ~1 box).
  if (arena.obstacles) {
    for (const o of arena.obstacles) {
      o.w = Math.min(o.w, Math.max(8, b.w - 8));
      o.h = Math.min(o.h, Math.max(8, b.h - 8));
      o.x = Math.max(b.x + 4, Math.min(o.x, b.x + b.w - o.w - 4));
      o.y = Math.max(b.y + 4, Math.min(o.y, b.y + b.h - o.h - 4));
    }
    obstacles = arena.obstacles;
  }
  // Keep player inside the newly-sized arena
  if (player) {
    const r = physics.playerRadius;
    const wall = 4;
    player.x = Math.max(b.x + wall + r, Math.min(player.x, b.x + b.w - wall - r));
    player.y = Math.max(b.y + wall + r, Math.min(player.y, b.y + b.h - wall - r));
  }
  // Keep target inside, regenerate if it fell outside or into a square
  if (target) {
    if (target.x < b.x + 30 || target.x > b.x + b.w - 30 ||
        target.y < b.y + 30 || target.y > b.y + b.h - 30 ||
        clearanceFromObstacles(target.x, target.y) < physics.targetRadius + 6) {
      if (player) target = generateTarget();
    }
  }
  // Never let a resize clamp the player onto a square (unfair instant death)
  if (player) dropBlockersNear(player.x, player.y, physics.playerRadius);
}

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const wrapperW = wrapper.clientWidth - 48;
  // Fit height too so mobile needs no scroll: reserve header + 2 pill rows + joystick + hints + footer
  const reserved = isTouchDevice ? 480 : 290;
  const availH = window.innerHeight - reserved;
  const maxSize = Math.min(800, wrapperW, availH);
  canvasSize = Math.max(200, maxSize);
  canvas.style.width = canvasSize + 'px';
  canvas.style.height = canvasSize + 'px';
  logicalW = canvasSize;
  logicalH = canvasSize;
  canvas.width = canvasSize * dpr;
  canvas.height = canvasSize * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  syncArenaToCanvas();
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);
setTimeout(resizeCanvas, 100);

// ---- ARENA GENERATION ----
function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

function pickArenaType() {
  const types = ['A', 'B', 'C', 'D', 'E'];
  return types[randomInt(0, types.length - 1)];
}

function safeRange(min, max) {
  if (!(max > min) || !isFinite(min) || !isFinite(max)) return null;
  return min + Math.random() * (max - min);
}

function clearanceFromObstacles(x, y) {
  let c = Infinity;
  for (const o of arena.obstacles) {
    const cx = Math.max(o.x, Math.min(x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(y, o.y + o.h));
    const d = Math.hypot(x - cx, y - cy);
    if (d < c) c = d;
  }
  return c;
}

function clampToArena(x, y, pad) {
  const m = arena.bounds;
  return {
    x: Math.max(m.x + pad, Math.min(x, m.x + m.w - pad)),
    y: Math.max(m.y + pad, Math.min(y, m.y + m.h - pad))
  };
}

function dropBlockersNear(x, y, minClear) {
  // Hard safety net: remove squares crowding a point (spawn / ring) so a
  // fresh run can never start dead and rings never sit inside squares.
  let guard = 0;
  while (guard++ < 10 && arena.obstacles.length > 0) {
    let bi = -1, bd = Infinity;
    for (let i = 0; i < arena.obstacles.length; i++) {
      const o = arena.obstacles[i];
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      const d = Math.hypot(x - cx, y - cy);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi === -1 || bd >= minClear) break;
    arena.obstacles.splice(bi, 1);
  }
}

function topUpObstacles(targetCount, excludes) {
  // Safety clearing above only removes true overlaps, but with exact
  // counts (easy = 1 box) even one removal breaks the spec — so re-add
  // whatever was deleted, keeping clear of spawn/ring bubbles.
  if (!arena || !arena.obstacles || arena.obstacles.length >= targetCount) return;
  const diff = DIFFICULTY[currentDifficulty];
  const b = arena.bounds;
  let sizeScale = diff.size;
  const room = Math.min(b.w, b.h);
  if (room < 320) sizeScale *= Math.max(0.45, room / 320);
  const baseGap = (typeof diff.gap === 'number') ? diff.gap : 50;
  const tinyK = room < 320 ? Math.max(0.55, room / 320) : 1;
  const minGap = Math.max(34 * tinyK, baseGap * Math.max(0.6, Math.min(1, room / 600)));
  const pool = (Array.isArray(diff.shapes) && diff.shapes.length > 0) ? diff.shapes : ['A', 'B', 'C', 'D', 'E'];
  const floor = Math.max(28 * tinyK, minGap * 0.7);
  let guard = 0;
  while (arena.obstacles.length < targetCount && guard++ < targetCount) {
    // Prefer the pool shape with fewest boxes so medium stays 1 rect + 1 square.
    const counts = {};
    for (const o of arena.obstacles) counts[o.s] = (counts[o.s] || 0) + 1;
    let shape = pool[0], fewest = Infinity;
    for (const s of pool) {
      const c = counts[s] || 0;
      if (c < fewest) { fewest = c; shape = s; }
    }
    let w, h;
    if (shape === 'D') {
      w = randomRange(40, 120) * sizeScale;
      h = randomRange(8, 20) * sizeScale;
    } else if (shape === 'E') {
      w = randomRange(30, 80) * sizeScale;
      h = randomRange(30, 80) * sizeScale;
    } else {
      w = randomRange(30, 100) * sizeScale;
      h = randomRange(30, 100) * sizeScale;
    }
    w = Math.max(8, Math.round(w));
    h = Math.max(8, Math.round(h));
    w = Math.min(w, Math.max(8, b.w - 40));
    h = Math.min(h, Math.max(8, b.h - 40));
    if (w < 8 || h < 8) break;
    for (let a = 0; a < 120; a++) {
      const g = a < 70 ? minGap : floor;
      const x = safeRange(b.x + 20, b.x + b.w - w - 20);
      const y = safeRange(b.y + 20, b.y + b.h - h - 20);
      if (x === null || y === null) break;
      let ok = true;
      for (const o of arena.obstacles) {
        const dx = Math.abs((x + w / 2) - (o.x + o.w / 2));
        const dy = Math.abs((y + h / 2) - (o.y + o.h / 2));
        if (dx < (o.w / 2 + w / 2) + g && dy < (o.h / 2 + h / 2) + g) { ok = false; break; }
      }
      if (ok && Array.isArray(excludes)) {
        for (const e of excludes) {
          const cx = Math.max(x, Math.min(e.x, x + w));
          const cy = Math.max(y, Math.min(e.y, y + h));
          if (Math.hypot(e.x - cx, e.y - cy) < e.r) { ok = false; break; }
        }
      }
      if (ok) { arena.obstacles.push({ x, y, w, h, s: shape }); break; }
    }
    // NOTE: if a shape won't fit anywhere after 120 tries the loop ends
    // via the guard — a missing box beats a forced unfair one.
  }
  obstacles = arena.obstacles;
}

function generateArena() {
  const type = pickArenaType();
  const margin = 40;
  const bounds = {
    x: margin,
    y: margin,
    w: canvasSize - margin * 2,
    h: canvasSize - margin * 2
  };

  const obs = [];
  const diff = DIFFICULTY[currentDifficulty];
  const count = diff.count;
  let sizeScale = diff.size;

  const room = Math.min(bounds.w, bounds.h);
  // Shrink boxes (not the count) on small screens so the requested
  // number of boxes can still fit. Tiny phone arenas get mini boxes.
  if (room < 320) sizeScale *= Math.max(0.45, room / 320);
  // Gap scales with difficulty AND arena size, but never below a
  // playable corridor (~player diameter + margin) so runs stay fair.
  // On tiny screens gaps shrink proportionally with the boxes.
  const tinyK = room < 320 ? Math.max(0.55, room / 320) : 1;
  const baseGap = (typeof diff.gap === 'number') ? diff.gap : 50;
  const minGap = Math.max(34 * tinyK, baseGap * Math.max(0.6, Math.min(1, room / 600)));
  // Cap total box coverage so many small boxes can't pave the arena.
  const maxCover = bounds.w * bounds.h * 0.22;
  let cover = 0;

  // Per-difficulty shape pool: E = square, D = rectangle bar.
  // Shuffled then cycled, so medium (D,E) always gives 1 rect + 1 square.
  const pool = (Array.isArray(diff.shapes) && diff.shapes.length > 0) ? diff.shapes : ['A', 'B', 'C', 'D', 'E'];
  const order = [...pool].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    const shape = order[i % order.length];
    let w, h;
    if (shape === 'D') {
      w = randomRange(40, 120) * sizeScale;
      h = randomRange(8, 20) * sizeScale;
    } else if (shape === 'E') {
      w = randomRange(30, 80) * sizeScale;
      h = randomRange(30, 80) * sizeScale;
    } else {
      w = randomRange(30, 100) * sizeScale;
      h = randomRange(30, 100) * sizeScale;
    }
    // Clamp to the 8px minimum instead of discarding: a rolled 6px bar
    // becomes an 8px bar, so small difficulties keep their exact count.
    w = Math.max(8, Math.round(w));
    h = Math.max(8, Math.round(h));
    w = Math.min(w, Math.max(8, bounds.w - 40));
    h = Math.min(h, Math.max(8, bounds.h - 40));
    if (w < 8 || h < 8) continue;

    // Skip boxes that would overfill the arena — fewer fair boxes
    // beats many impossible ones. Never i-- loop.
    const area = w * h;
    if (cover + area > maxCover) continue;
    // Bounded attempts with mildly relaxed spacing. The floor stays
    // playable (never packs boxes skin-to-skin); a box that won't fit
    // with room to dodge is skipped instead of forced in.
    const relaxFloor = Math.max(28 * tinyK, minGap * 0.7);
    let placed = false;
    for (let attempt = 0; attempt < 120 && !placed; attempt++) {
      const effGap = attempt < 70 ? minGap : relaxFloor;
      const x = safeRange(bounds.x + 20, bounds.x + bounds.w - w - 20);
      const y = safeRange(bounds.y + 20, bounds.y + bounds.h - h - 20);
      if (x === null || y === null) break;

      let valid = true;
      for (const o of obs) {
        const dx = Math.abs((x + w / 2) - (o.x + o.w / 2));
        const dy = Math.abs((y + h / 2) - (o.y + o.h / 2));
        if (dx < (o.w / 2 + w / 2) + effGap && dy < (o.h / 2 + h / 2) + effGap) {
          valid = false;
          break;
        }
      }
      if (valid) {
        obs.push({ x, y, w, h, s: shape });
        cover += w * h;
        placed = true;
      }
    }
  }

  return { type, bounds, obstacles: obs };
}

function generatePlayerSpawn() {
  const m = arena.bounds;
  const need = 60 + physics.playerRadius;
  const pad = 4 + physics.playerRadius;
  // Best-of-N by clearance, validated AFTER clamping — spawn is never
  // accepted inside (or a death away from) a square. Always terminates.
  let best = clampToArena(m.x + m.w / 2, m.y + m.h / 2, pad);
  let bestC = clearanceFromObstacles(best.x, best.y);
  for (let t = 0; t < 200; t++) {
    let x = safeRange(m.x + 80, m.x + m.w - 80);
    let y = safeRange(m.y + 80, m.y + m.h - 80);
    if (x === null) x = m.x + m.w / 2;
    if (y === null) y = m.y + m.h / 2;
    const p = clampToArena(x, y, pad);
    const c = clearanceFromObstacles(p.x, p.y);
    if (c > bestC) { bestC = c; best = p; }
    if (bestC >= need) break;
  }
  return { x: best.x, y: best.y };
}

function generateTarget() {
  const m = arena.bounds;
  const needObs = 42 + physics.targetRadius;
  const pad = 4 + physics.targetRadius;
  // Scale the away-from-player rule to arena size: a fixed 100px starved
  // small arenas so rings only ever appeared on the far side. Rings now
  // spread across the whole box on every screen size.
  const minPlayerDist = Math.max(30, Math.min(100, Math.min(m.w, m.h) * 0.18));
  const center = clampToArena(m.x + m.w / 2, m.y + m.h / 2, pad);
  let best = null, bestC = -1; // fully valid: far from player + clear of squares
  let fall = center, fallC = clearanceFromObstacles(center.x, center.y); // best effort
  for (let t = 0; t < 200; t++) {
    let x = safeRange(m.x + 30, m.x + m.w - 30);
    let y = safeRange(m.y + 30, m.y + m.h - 30);
    if (x === null) x = center.x;
    if (y === null) y = center.y;
    const p = clampToArena(x, y, pad);
    const c = clearanceFromObstacles(p.x, p.y);
    if (c > fallC) { fallC = c; fall = p; }
    if (Math.hypot(p.x - player.x, p.y - player.y) < minPlayerDist) continue;
    if (c > bestC) { bestC = c; best = p; }
    if (c >= needObs) break;
  }
  const pick = best || fall;
  // Guarantee the ring is always collectible: never inside/against a square.
  dropBlockersNear(pick.x, pick.y, physics.playerRadius + physics.targetRadius + 4);
  return { x: pick.x, y: pick.y, radius: physics.targetRadius };
}

// ---- PARTICLES ----
function spawnParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = randomRange(0, Math.PI * 2);
    const speed = randomRange(0.5, 2);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(15, 30),
      maxLife: 30,
      radius: randomRange(1, 2.5)
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ---- PLAYER PHYSICS ----
function getInput() {
  // Analog stick: smoothed vector already carries magnitude 0..1 —
  // do NOT re-normalize (that would erase small-tilt precision).
  const sMag = Math.hypot(smoothX, smoothY);
  if (sMag > 0.002) {
    return { x: smoothX, y: smoothY, mag: Math.min(1, sMag) };
  }
  if (touchDirection && typeof touchDirection.ax === 'number') {
    const m = Math.hypot(touchDirection.ax, touchDirection.ay);
    if (m > 0.002) return { x: touchDirection.ax, y: touchDirection.ay, mag: Math.min(1, m) };
  }
  let ix = 0, iy = 0;
  if (keys['ArrowUp'] || keys['w'] || keys['W']) iy = -1;
  if (keys['ArrowDown'] || keys['s'] || keys['S']) iy = 1;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) ix = -1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) ix = 1;
  // Keyboard only: normalize so diagonal speed == cardinal speed.
  const len = Math.hypot(ix, iy);
  if (len > 0) { ix /= len; iy /= len; }
  return { x: ix, y: iy, mag: len > 0 ? 1 : 0 };
}

function updatePlayer(dt) {
  const input = getInput();
  const dtN = (typeof dt === 'number' && dt > 0) ? Math.min(32, dt) / 16.666 : 1;
  const iMag = Math.min(1, Math.hypot(input.x, input.y));
  // Analog magnitude scales acceleration: 0.25 floor keeps tiny tilts alive,
  // full tilt = full speed. Product with iMag keeps deadzone continuous.
  const powerCurve = iMag;
  const accelScale = 0.25 + 0.75 * powerCurve;
  const acc = physics.acceleration * accelScale * dtN;
  player.vx += input.x * acc;
  player.vy += input.y * acc;
  // Tight stop: extra friction on release so the circle halts with no slide.
  const joyIdle = iMag <= 0.002;
  const baseF = physics.friction;
  const friction = joyIdle ? Math.pow(baseF, dtN) * Math.pow(0.96, dtN) : Math.pow(baseF, dtN);
  player.vx *= friction;
  player.vy *= friction;
  // Kill sub-pixel drift.
  if (joyIdle && Math.hypot(player.vx, player.vy) < 0.02) { player.vx = 0; player.vy = 0; }

  const spd = Math.hypot(player.vx, player.vy);
  if (spd > physics.maxVelocity) {
    player.vx = (player.vx / spd) * physics.maxVelocity;
    player.vy = (player.vy / spd) * physics.maxVelocity;
  }

  player.x += player.vx;
  player.y += player.vy;

  const b = arena.bounds;
  const r = physics.playerRadius;
  const wall = 4; // must match borderWidth in render()

  if (player.x - r < b.x + wall) {
    player.x = b.x + wall + r;
    player.vx = Math.abs(player.vx) * physics.bounce;
  }
  if (player.x + r > b.x + b.w - wall) {
    player.x = b.x + b.w - wall - r;
    player.vx = -Math.abs(player.vx) * physics.bounce;
  }
  if (player.y - r < b.y + wall) {
    player.y = b.y + wall + r;
    player.vy = Math.abs(player.vy) * physics.bounce;
  }
  if (player.y + r > b.y + b.h - wall) {
    player.y = b.y + b.h - wall - r;
    player.vy = -Math.abs(player.vy) * physics.bounce;
  }
}

// ---- COLLISION ----
function checkObstacleCollision() {
  for (const o of arena.obstacles) {
    const cx = Math.max(o.x, Math.min(player.x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(player.y, o.y + o.h));
    const dx = player.x - cx;
    const dy = player.y - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < physics.playerRadius) {
      // One hit ends the run — this is what saves bests/history.
      spawnParticles(player.x, player.y, 14);
      gameOver();
      return;
    }
  }
}

function checkTargetCollision() {
  const dx = player.x - target.x;
  const dy = player.y - target.y;
  const dist = Math.hypot(dx, dy);
  if (dist < physics.playerRadius + physics.targetRadius) {
    score += 10;
    spawnParticles(target.x, target.y, 8);
    target = generateTarget();
  }
}

function checkArenaLoss() {
  const b = arena.bounds;
  if (player.x < b.x - 5 || player.x > b.x + b.w + 5 ||
      player.y < b.y - 5 || player.y > b.y + b.h + 5) {
    return true;
  }
  return false;
}

// ---- DIFFICULTY ----
function updateDifficulty() {
  const cfg = SPEEDS[currentSpeed];
  const t = elapsedTime;
  difficulty = 1 + t / 60 * cfg.ramp;

  if (t > 30) {
    physics.friction = Math.max(0.968, cfg.baseFriction - (t - 30) / 30 * 0.01);
  } else {
    physics.friction = cfg.baseFriction;
  }
  if (t > 20) {
    physics.maxVelocity = Math.min(cfg.capMaxVel, cfg.baseMaxVel + (t - 20) / 40 * 2);
  } else {
    physics.maxVelocity = cfg.baseMaxVel;
  }
}

// ---- GAME STATE ----
function setRestartText(mode) {
  if (!goRestart) return;
  const start = mode === 'start';
  if (isTouchDevice) goRestart.textContent = start ? 'TAP TO START' : 'TAP TO TRY AGAIN';
  else goRestart.textContent = start ? 'PRESS SPACE TO START' : 'PRESS SPACE TO TRY AGAIN';
}

function setupWorld() {
  bestBySpeed = {
    low: loadBestFor('low'),
    medium: loadBestFor('medium'),
    high: loadBestFor('high'),
    extreme: loadBestFor('extreme')
  };
  best = bestBySpeed[currentSpeed];
  runHistory = loadHistory();
  isNewBest = false;
  if (newBestBadge) newBestBadge.classList.remove('visible');
  renderSpeedUI();
  renderDifficultyUI();
  renderFooterBest();
  renderGameOverHistory();
  score = 0;
  elapsedTime = 0;
  difficulty = 1;
  particles = [];
  applySpeedPhysics();

  arena = generateArena();
  const spawn = generatePlayerSpawn();
  player = { x: spawn.x, y: spawn.y, vx: 0, vy: 0, radius: physics.playerRadius };
  // Overlap-only clearing (spawn seeks 74px open space already, so this
  // almost never fires) + top-up restores the exact spec count:
  // easy 1, medium 2, high 3, extreme 4 — never 0.
  const want = DIFFICULTY[currentDifficulty].count;
  dropBlockersNear(player.x, player.y, physics.playerRadius + 4);
  topUpObstacles(want, [{ x: player.x, y: player.y, r: physics.playerRadius + 10 }]);
  target = generateTarget();
  dropBlockersNear(target.x, target.y, physics.targetRadius + 4);
  topUpObstacles(want, [
    { x: player.x, y: player.y, r: physics.playerRadius + 10 },
    { x: target.x, y: target.y, r: physics.playerRadius + physics.targetRadius + 6 }
  ]);
  obstacles = arena.obstacles;
  running = true;
  updateHUD();
}

function showStartScreen() {
  setupWorld();
  state = STATES.OVER;
  setRestartText('start');
  gameOverScreen.classList.add('active');
}

function createGame() {
  setupWorld();
  state = STATES.PLAYING;
  gameOverScreen.classList.remove('active');
}

function gameOver() {
  state = STATES.OVER;
  goScore.textContent = 'SCORE ' + score;
  goTime.textContent = 'TIME ' + elapsedTime.toFixed(1);
  const run = {
    score: score,
    time: Math.round(elapsedTime * 10) / 10,
    date: new Date().toISOString(),
    speed: currentSpeed,
    difficulty: currentDifficulty
  };
  const prevBest = bestBySpeed[currentSpeed] || defaultBest();
  isNewBest = run.score > prevBest.score;
  if (isNewBest) {
    bestBySpeed[currentSpeed] = { score: run.score, time: run.time, date: run.date };
    saveBestFor(currentSpeed, bestBySpeed[currentSpeed]);
  }
  best = bestBySpeed[currentSpeed];
  runHistory.unshift(run);
  runHistory = runHistory.slice(0, HISTORY_MAX);
  saveHistory(runHistory);
  if (newBestBadge) newBestBadge.classList.toggle('visible', isNewBest);
  setRestartText('again');
  renderFooterBest();
  renderGameOverHistory();
  gameOverScreen.classList.add('active');
}

function restartGame() {
  createGame();
}

// ---- RENDERING ----
function render() {
  ctx.clearRect(0, 0, logicalW, logicalH);

  const b = arena.bounds;
  const borderWidth = 4;

  // Outside (margin) area — darker so the playfield stands out
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, logicalW, logicalH);

  // Playfield background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(b.x, b.y, b.w, b.h);

  // Visible thick border wall (drawn just inside bounds so it is fully visible)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(
    b.x + borderWidth / 2,
    b.y + borderWidth / 2,
    b.w - borderWidth,
    b.h - borderWidth
  );

  for (const o of obstacles) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  ctx.beginPath();
  ctx.arc(target.x, target.y, physics.targetRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(player.x, player.y, physics.playerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`;
    ctx.fill();
  }

  // (In-canvas touch crosshair removed — steering is on the bottom joystick.)
}

// ---- HUD ----
function updateHUD() {
  hudScore.textContent = 'SCORE ' + score;
  hudTime.textContent = 'TIME ' + elapsedTime.toFixed(1);
  if (hudBest) hudBest.textContent = SPEEDS[currentSpeed].label + ' BEST ' + best.score;
}

// ---- MAIN LOOP ----
function loop(timestamp) {
  requestAnimationFrame(loop);

  if (!running) return;

  const dt = Math.min(timestamp - lastTime, 32);
  lastTime = timestamp;

  // 60fps knob animation + analog smoothing runs every frame (even on
  // game-over screen so the stick always springs back with no drift).
  try { joyTick(dt); } catch (e) { /* joystick not ready */ }

  if (state === STATES.PLAYING) {
    elapsedTime += dt / 1000;
    updateDifficulty();
    updatePlayer(dt);
    checkObstacleCollision();
    if (state === STATES.PLAYING) {
      checkTargetCollision();
      updateParticles();
      updateHUD();
    }

    if (checkArenaLoss()) {
      gameOver();
    }
  }

  render();
}

// ---- START ----
resizeCanvas();
renderSpeedUI();
renderDifficultyUI();
lastTime = performance.now();
showStartScreen();
requestAnimationFrame(loop);
