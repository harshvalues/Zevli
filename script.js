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

// ---- BOX DIFFICULTY (count + size flip: easy = few BIG boxes,
// extreme = MANY SMALL boxes) ----
const DIFFICULTY = {
  easy:    { label: 'EASY',    count: 2, size: 1.3 },
  medium:  { label: 'MEDIUM',  count: 4, size: 1.0 },
  high:    { label: 'HIGH',    count: 6, size: 0.85 },
  extreme: { label: 'EXTREME', count: 12, size: 0.7 }
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

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  handleTouch(e);
  if (state === STATES.OVER) { restartGame(); return; }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  handleTouch(e);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  touchDirection = null;
  touchActive = false;
}, { passive: false });

canvas.addEventListener('touchcancel', (e) => {
  e.preventDefault();
  touchDirection = null;
  touchActive = false;
}, { passive: false });

let touchActive = false;

function handleTouch(e) {
  const touch = e.touches && e.touches[0];
  if (!touch) {
    touchDirection = null;
    touchActive = false;
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = logicalW / Math.max(1, rect.width);
  const scaleY = logicalH / Math.max(1, rect.height);
  const tx = (touch.clientX - rect.left) * scaleX;
  const ty = (touch.clientY - rect.top) * scaleY;
  touchDirection = { x: tx - logicalW / 2, y: ty - logicalH / 2 };
  const len = Math.hypot(touchDirection.x, touchDirection.y);
  if (len > 0) { touchDirection.x /= len; touchDirection.y /= len; }
  touchActive = true;
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
  // Drop obstacles that no longer fit (happens on window shrink)
  if (arena.obstacles) {
    arena.obstacles = arena.obstacles.filter(
      (o) => o.x >= b.x && o.y >= b.y && o.x + o.w <= b.x + b.w && o.y + o.h <= b.y + b.h
    );
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
  // Fit height too so mobile needs no scroll: reserve header + 2 pill rows + hints + footer
  const reserved = isTouchDevice ? 330 : 290;
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
  const minGap = 50;
  const diff = DIFFICULTY[currentDifficulty];
  let count = diff.count;
  const sizeScale = diff.size;

  // Tiny arenas can't fit many separated blocks — shrink the budget
  // so placement always terminates (never freeze the page).
  const room = Math.min(bounds.w, bounds.h);
  if (room < 150) count = 0;
  else if (room < 240) count = Math.min(count, 2);

  for (let i = 0; i < count; i++) {
    const shape = pickArenaType();
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
    w = Math.round(w);
    h = Math.round(h);
    w = Math.min(w, bounds.w - 40);
    h = Math.min(h, bounds.h - 40);
    if (w < 8 || h < 8) continue;

    // Bounded attempts: skip this block if it won't fit apart. Never i-- loop.
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = safeRange(bounds.x + 20, bounds.x + bounds.w - w - 20);
      const y = safeRange(bounds.y + 20, bounds.y + bounds.h - h - 20);
      if (x === null || y === null) break;

      let valid = true;
      for (const o of obs) {
        const dx = Math.abs(x - (o.x + o.w / 2));
        const dy = Math.abs(y - (o.y + o.h / 2));
        if (dx < (o.w / 2 + w / 2) + minGap && dy < (o.h / 2 + h / 2) + minGap) {
          valid = false;
          break;
        }
      }
      if (valid) {
        obs.push({ x, y, w, h });
        break;
      }
    }
  }

  return { type, bounds, obstacles: obs };
}

function generatePlayerSpawn() {
  const m = arena.bounds;
  const need = 40 + physics.playerRadius;
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
  const needObs = 30 + physics.targetRadius;
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
  let ix = 0, iy = 0;
  if (keys['ArrowUp'] || keys['w'] || keys['W']) iy = -1;
  if (keys['ArrowDown'] || keys['s'] || keys['S']) iy = 1;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) ix = -1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) ix = 1;
  if (touchDirection) {
    ix = touchDirection.x;
    iy = touchDirection.y;
  }
  const len = Math.hypot(ix, iy);
  if (len > 0) { ix /= len; iy /= len; }
  return { x: ix, y: iy };
}

function updatePlayer() {
  const input = getInput();
  player.vx += input.x * physics.acceleration;
  player.vy += input.y * physics.acceleration;
  player.vx *= physics.friction;
  player.vy *= physics.friction;

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
  dropBlockersNear(player.x, player.y, 24);
  target = generateTarget();
  dropBlockersNear(target.x, target.y, physics.playerRadius + physics.targetRadius + 4);
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

  if (touchActive && touchDirection) {
    const angle = Math.atan2(touchDirection.y, touchDirection.x);
    const dist = 30;
    const tx = logicalW / 2 + Math.cos(angle) * dist;
    const ty = logicalH / 2 + Math.sin(angle) * dist;
    ctx.beginPath();
    ctx.arc(tx, ty, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(logicalW / 2, logicalH / 2);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
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

  if (state === STATES.PLAYING) {
    elapsedTime += dt / 1000;
    updateDifficulty();
    updatePlayer();
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
