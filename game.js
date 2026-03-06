"use strict";

/**
 * Spot It deck generator (Finite Projective Plane construction)
 * For symbols-per-card n = q + 1, where q is prime (we use q=3,5,7).
 * #symbols = q^2 + q + 1
 * #cards   = q^2 + q + 1
 *
 * Your images: 1.png .. 57.png inside /assets
 */

const ASSET_DIR = "assets"; // change if you use a different folder name

// UI
const setupPanel = document.getElementById("setupPanel");
const endPanel = document.getElementById("endPanel");
const gameArea = document.getElementById("gameArea");
const cardAEl = document.getElementById("cardA");
const cardBEl = document.getElementById("cardB");
const toastEl = document.getElementById("toast");

const difficultyEl = document.getElementById("difficulty");
const durationEl = document.getElementById("duration");

const btnStart = document.getElementById("btnStart");
const btnRestart = document.getElementById("btnRestart");
const btnPlayAgain = document.getElementById("btnPlayAgain");

const timeLeftEl = document.getElementById("timeLeft");
const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("finalScore");

// Game state
let deck = [];
let currentPair = null; // { a: [symIds], b: [symIds], common: symId }
let score = 0;
let timeLeft = 0;
let timerId = null;
let gameRunning = false;

// Difficulty configuration
const DIFF = {
  easy:   { q: 3, symbolsPerCard: 4, symbolCount: 13 },
  medium: { q: 5, symbolsPerCard: 6, symbolCount: 31 },
  hard:   { q: 7, symbolsPerCard: 8, symbolCount: 57 },
};

// ---------- Utilities ----------
function $(id){ return document.getElementById(id); }

function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  toastEl.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    toastEl.classList.remove("show");
    toastEl.setAttribute("aria-hidden", "true");
  }, 700);
}
function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function imageUrlForSymbol(symId){
  // symId is 1..57
  return `${ASSET_DIR}/${symId}.png`;
}

// ---------- Deck generation ----------
/**
 * Build a Spot-It-perfect deck for prime q.
 * Represent "points" (symbols) as:
 *  - (x,y) for x,y in 0..q-1  => q^2 points
 *  - INF_m for m in 0..q-1    => q points
 *  - INF_INF                  => 1 point
 *
 * Lines (cards):
 *  - For each slope m and intercept b: y = m*x + b  => q^2 lines
 *    Contains (x, m*x+b) for all x plus INF_m
 *  - For each vertical x=c:                         => q lines
 *    Contains (c,y) for all y plus INF_INF
 *  - The line at infinity                           => 1 line
 *    Contains all INF_m plus INF_INF
 *
 * Each line has q+1 symbols; any two lines intersect in exactly 1 point.
 */
function buildDeckForQ(q){
  const points = []; // index -> point object
  const pointId = new Map(); // key -> id (1-based)

  function addPoint(key){
    points.push(key);
    pointId.set(key, points.length); // 1-based id
  }

  // (x,y) points
  for (let x = 0; x < q; x++){
    for (let y = 0; y < q; y++){
      addPoint(`P:${x},${y}`);
    }
  }
  // INF_m points
  for (let m = 0; m < q; m++){
    addPoint(`INF:${m}`);
  }
  // INF_INF point
  addPoint(`INF:INF`);

  const cards = [];

  // Lines y = m*x + b
  for (let m = 0; m < q; m++){
    for (let b = 0; b < q; b++){
      const card = [];
      for (let x = 0; x < q; x++){
        const y = (m * x + b) % q;
        card.push(pointId.get(`P:${x},${y}`));
      }
      card.push(pointId.get(`INF:${m}`));
      cards.push(card);
    }
  }

  // Vertical lines x = c
  for (let c = 0; c < q; c++){
    const card = [];
    for (let y = 0; y < q; y++){
      card.push(pointId.get(`P:${c},${y}`));
    }
    card.push(pointId.get(`INF:INF`));
    cards.push(card);
  }

  // Line at infinity
  const infinityCard = [];
  for (let m = 0; m < q; m++){
    infinityCard.push(pointId.get(`INF:${m}`));
  }
  infinityCard.push(pointId.get(`INF:INF`));
  cards.push(infinityCard);

  // Sanity
  const expected = q*q + q + 1;
  if (points.length !== expected || cards.length !== expected){
    throw new Error(`Deck generation failed: got points=${points.length}, cards=${cards.length}, expected=${expected}`);
  }

  return cards; // array of arrays of symbol IDs
}

// ---------- Rendering ----------
function clearCard(el){
  el.innerHTML = "";
}

function renderCard(el, symbols) {
  clearCard(el);

  const rect = el.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  const cx = W / 2;
  const cy = H / 2;
  const minSide = Math.min(W, H);

  const list = shuffle([...symbols]);
  const n = list.length;

  // התאמה לפי כמות סמלים (4/6/8)
  const base =
    n === 4 ? minSide * 0.26 :
    n === 6 ? minSide * 0.22 :
              minSide * 0.19;

  const centerScale =
    n === 4 ? 1.10 :
    n === 6 ? 1.00 :
              0.95;

  const outerScaleMin =
    n === 4 ? 0.95 :
    n === 6 ? 0.82 :
              0.72;

  const outerScaleMax =
    n === 4 ? 1.08 :
    n === 6 ? 0.98 :
              0.88;

  const radius =
    n === 4 ? minSide * 0.30 :
    n === 6 ? minSide * 0.34 :
              minSide * 0.37;

  // 1) סמל מרכז
  const centerId = list[0];
  const cimg = document.createElement("img");
  cimg.className = "icon";
  cimg.src = imageUrlForSymbol(centerId);
  cimg.dataset.symbolId = String(centerId);

  const cSize = base * centerScale;
  cimg.style.width = `${cSize}px`;
  cimg.style.height = `${cSize}px`;
  cimg.style.left = `${cx}px`;
  cimg.style.top = `${cy}px`;
  cimg.style.transform = `translate(-50%, -50%) rotate(${(Math.random()*24-12).toFixed(1)}deg)`;
  cimg.addEventListener("pointerdown", onIconPress, { passive: true });
  el.appendChild(cimg);

  // 2) השאר מסביב – מרווחים שווים, בלי חפיפות
  const others = list.slice(1);
  const step = (Math.PI * 2) / others.length;
  const start = Math.random() * Math.PI * 2;

  others.forEach((symId, i) => {
    const angle = start + i * step;

    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    const img = document.createElement("img");
    img.className = "icon";
    img.src = imageUrlForSymbol(symId);
    img.dataset.symbolId = String(symId);

    const scale = rand(outerScaleMin, outerScaleMax);
    const size = base * scale;

    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.left = `${x}px`;
    img.style.top = `${y}px`;
    img.style.transform = `translate(-50%, -50%) rotate(${(Math.random()*60-30).toFixed(1)}deg)`;

    img.addEventListener("pointerdown", onIconPress, { passive: true });
    el.appendChild(img);
  });
}

// טבעות מומלצות לפי מספר סמלים
function buildRings(n){
  // מרכז: 1
  // טבעת פנימית: ~ (n-1)/2
  // טבעת חיצונית: השאר
  if (n <= 4){
    return [
      { count: 1, rMin: 0.00, rMax: 0.05 },
      { count: n - 1, rMin: 0.35, rMax: 0.65 },
    ];
  }
  if (n <= 6){
    return [
      { count: 1, rMin: 0.00, rMax: 0.05 },
      { count: 2, rMin: 0.25, rMax: 0.45 },
      { count: n - 3, rMin: 0.55, rMax: 0.85 },
    ];
  }
  // n = 8 (קשה) וגם אם בעתיד תגדילי
  return [
    { count: 1, rMin: 0.00, rMax: 0.05 },
    { count: 3, rMin: 0.25, rMax: 0.50 },
    { count: n - 4, rMin: 0.58, rMax: 0.90 },
  ];
}

function rectsOverlap(a, b, pad){
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

// ---------- Game logic ----------
function intersectionSymbol(card1, card2){
  const set = new Set(card1);
  for (const s of card2){
    if (set.has(s)) return s;
  }
  return null;
}

function pickNewPair(){
  if (!deck || deck.length < 2) return null;
  let i = Math.floor(Math.random() * deck.length);
  let j = Math.floor(Math.random() * deck.length);
  while (j === i) j = Math.floor(Math.random() * deck.length);

  const a = deck[i];
  const b = deck[j];
  const common = intersectionSymbol(a, b);

  // Should never be null in a valid deck
  return { a, b, common };
}

function updateHud(){
  timeLeftEl.textContent = `${timeLeft}s`;
  scoreEl.textContent = String(score);
}

function setPanels(state){
  // state: "setup" | "playing" | "end"
  setupPanel.classList.toggle("hidden", state !== "setup");
  endPanel.classList.toggle("hidden", state !== "end");
  gameArea.classList.toggle("hidden", state === "setup" || state === "end");
}

function startGame(){
  const diffKey = difficultyEl.value;
  const config = DIFF[diffKey] ?? DIFF.hard;
  const duration = Number(durationEl.value) || 60;

  // Build perfect deck for this difficulty
  deck = buildDeckForQ(config.q);

  // Since your assets are 1..57:
  // - easy uses symbols 1..13
  // - medium uses 1..31
  // - hard uses 1..57
  // The deck we built already uses exactly that count per q, so it's aligned.

  score = 0;
  timeLeft = duration;
  gameRunning = true;
  updateHud();

  setPanels("playing");

  // First pair
  currentPair = pickNewPair();
  drawCurrentPair();

  // Timer
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    if (!gameRunning) return;
    timeLeft--;
    updateHud();
    if (timeLeft <= 0){
      endGame();
    }
  }, 1000);
}

function endGame(){
  gameRunning = false;
  if (timerId) clearInterval(timerId);
  timerId = null;

  finalScoreEl.textContent = String(score);
  setPanels("end");
}

function restartToSetup(){
  gameRunning = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  score = 0;
  timeLeft = 0;
  updateHud();
  setPanels("setup");
}

function drawCurrentPair(){
  if (!currentPair) return;

  // Re-render cards (use RAF so the card sizes are stable)
  requestAnimationFrame(() => {
    renderCard(cardAEl, currentPair.a);
    renderCard(cardBEl, currentPair.b);
  });
}

function onIconPress(e){
  if (!gameRunning || !currentPair) return;

  const symId = Number(e.currentTarget.dataset.symbolId);
  const isCorrect = symId === currentPair.common;

  if (isCorrect){
    score += 1;
    showToast("בול! +1 ✅");
    updateHud();

    currentPair = pickNewPair();
    drawCurrentPair();
  } else {
    // optional penalty
    score = Math.max(0, score - 1);
    showToast("לא זה… ‎-1 ❌");
    updateHud();
  }
}

// ---------- Wiring ----------
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", restartToSetup);
btnPlayAgain.addEventListener("click", () => {
  // keep selected settings, just start again
  setPanels("setup");
  startGame();
});

// Update HUD at load
updateHud();

// Helpful: if user rotates phone / resizes window, re-draw current pair so layout stays nice
window.addEventListener("resize", () => {
  if (gameRunning && currentPair){
    drawCurrentPair();
  }
});