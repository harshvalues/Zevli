const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hudScore = document.querySelector('.hud-score');
const hudTime = document.querySelector('.hud-time');
const gameOverScreen = document.getElementById('gameOverScreen');
const goScore = document.getElementById('goScore');
const goTime = document.getElementById('goTime');

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
  if (e.key === ' ' && state === STATES.OVER) restartGame();
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

let touchActive = false;

function handleTouch(e) {
  const touch = e.touches[0];
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
  document.querySelector('.game-wrapper').scrollIntoView({ behavior: 'smooth' });
});

// ---- CANVAS RESIZE ----
function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const wrapperW = wrapper.clientWidth - 48;
  const maxSize = Math.min(700, wrapperW);
  canvasSize = Math.max(200, maxSize);
  canvas.style.width = canvasSize + 'px';
  canvas.style.height = canvasSize + 'px';
  logicalW = canvasSize;
  logicalH = canvasSize;
  canvas.width = canvasSize * dpr;
  canvas.height = canvasSize * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

function generateArena() {
  const type = pickArenaType();
  const margin = 40;
  const bounds = {
    x: margin,
    y: margin,
    w: canvasSize - margin * 2,
    h: canvasSize - margin * 2
  };

  let obs = [];
  const maxObs = randomInt(2, 6);
  const minGap = 50;
  const maxRetry = 50;
  let retry = 0;

  while (retry < maxRetry) {
    retry++;
    obs = [];
    const count = type === 'A' ? randomInt(1, 2) :
                  type === 'B' ? randomInt(2, 3) :
                  type === 'C' ? randomInt(3, 5) :
                  type === 'D' ? randomInt(3, 5) : randomInt(2, 4);

    for (let i = 0; i < count; i++) {
      let w, h;
      if (type === 'D') {
        w = randomRange(40, 120);
        h = randomRange(8, 20);
      } else if (type === 'E') {
        w = randomRange(30, 80);
        h = randomRange(30, 80);
      } else {
        w = randomRange(30, 100);
        h = randomRange(30, 100);
      }

      let x = randomRange(bounds.x + 20, bounds.x + bounds.w - w - 20);
      let y = randomRange(bounds.y + 20, bounds.y + bounds.h - h - 20);

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
      } else {
        i--;
      }
    }
    break;
  }

  return { type, bounds, obstacles: obs };
}

function generatePlayerSpawn() {
  const m = arena.bounds;
  const margin = 80;
  let x, y, valid, tries = 0;
  do {
    valid = true;
    x = randomRange(m.x + margin, m.x + m.w - margin);
    y = randomRange(m.y + margin, m.y + m.h - margin);
    for (const o of arena.obstacles) {
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      const dx = x - cx;
      const dy = y - cy;
      if (Math.hypot(dx, dy) < 40 + physics.playerRadius) {
        valid = false;
        break;
      }
    }
    tries++;
  } while (!valid && tries < 200);
  return { x, y };
}

function generateTarget() {
  const m = arena.bounds;
  let x, y, valid, tries = 0;
  do {
    valid = true;
    x = randomRange(m.x + 30, m.x + m.w - 30);
    y = randomRange(m.y + 30, m.y + m.h - 30);
    for (const o of arena.obstacles) {
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      const dx = x - cx;
      const dy = y - cy;
      if (Math.hypot(dx, dy) < 30 + physics.targetRadius) {
        valid = false;
        break;
      }
    }
    if (Math.hypot(x - player.x, y - player.y) < 100) valid = false;
    tries++;
  } while (!valid && tries < 200);
  return { x, y, radius: physics.targetRadius };
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

  if (player.x - r < b.x) {
    player.x = b.x + r;
    player.vx = Math.abs(player.vx) * physics.bounce;
  }
  if (player.x + r > b.x + b.w) {
    player.x = b.x + b.w - r;
    player.vx = -Math.abs(player.vx) * physics.bounce;
  }
  if (player.y - r < b.y) {
    player.y = b.y + r;
    player.vy = Math.abs(player.vy) * physics.bounce;
  }
  if (player.y + r > b.y + b.h) {
    player.y = b.y + b.h - r;
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

    if (dist < physics.playerRadius && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      player.x = cx + nx * physics.playerRadius;
      player.y = cy + ny * physics.playerRadius;

      const dot = player.vx * nx + player.vy * ny;
      player.vx -= 2 * dot * nx * physics.bounce;
      player.vy -= 2 * dot * ny * physics.bounce;

      spawnParticles(cx, cy, 3);
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
  const t = elapsedTime;
  difficulty = 1 + t / 60 * 0.1;

  if (t > 30) {
    physics.friction = Math.max(0.97, 0.985 - (t - 30) / 30 * 0.01);
  }
  if (t > 20) {
    physics.maxVelocity = Math.min(9, 7 + (t - 20) / 40 * 2);
  }
}

// ---- GAME STATE ----
function createGame() {
  score = 0;
  elapsedTime = 0;
  difficulty = 1;
  particles = [];
  physics.friction = 0.985;
  physics.maxVelocity = 7;
  physics.acceleration = 0.35;
  physics.bounce = 0.5;
  physics.playerRadius = 14;
  physics.targetRadius = 8;

  arena = generateArena();
  const spawn = generatePlayerSpawn();
  player = { x: spawn.x, y: spawn.y, vx: 0, vy: 0, radius: physics.playerRadius };
  target = generateTarget();
  obstacles = arena.obstacles;
  state = STATES.PLAYING;
  gameOverScreen.classList.remove('active');
  running = true;
}

function gameOver() {
  state = STATES.OVER;
  goScore.textContent = 'SCORE ' + score;
  goTime.textContent = 'TIME ' + elapsedTime.toFixed(1);
  gameOverScreen.classList.add('active');
}

function restartGame() {
  createGame();
}

// ---- RENDERING ----
function render() {
  ctx.clearRect(0, 0, logicalW, logicalH);

  const b = arena.bounds;

  ctx.fillStyle = '#fafafa';
  ctx.fillRect(b.x, b.y, b.w, b.h);

  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x, b.y, b.w, b.h);

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
    checkTargetCollision();
    updateParticles();
    updateHUD();

    if (checkArenaLoss()) {
      gameOver();
    }
  }

  render();
}

// ---- START ----
lastTime = performance.now();
createGame();
requestAnimationFrame(loop);
