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
  const count = list.length;

  // התאמת גודל ורדיוס לפי כמות הסמלים
  let centerScale, outerScaleMin, outerScaleMax, outerRadius;

  if (count === 4) {
    centerScale = 1.28;
    outerScaleMin = 1.02;
    outerScaleMax = 1.16;
    outerRadius = minSide * 0.31;
  } else if (count === 6) {
    centerScale = 1.12;
    outerScaleMin = 0.88;
    outerScaleMax = 1.02;
    outerRadius = minSide * 0.34;
  } else {
    // 8 סמלים
    centerScale = 1.00;
    outerScaleMin = 0.72;
    outerScaleMax = 0.90;
    outerRadius = minSide * 0.355;
  }

  const baseSize = minSide * 0.19;

  // סמל מרכזי
  const centerId = list[0];
  const centerImg = document.createElement("img");
  centerImg.className = "icon";
  centerImg.src = imageUrlForSymbol(centerId);
  centerImg.dataset.symbolId = String(centerId);

  const centerSize = baseSize * centerScale;
  centerImg.style.width = `${centerSize}px`;
  centerImg.style.height = `${centerSize}px`;
  centerImg.style.left = `${cx}px`;
  centerImg.style.top = `${cy}px`;
  centerImg.style.transform = `translate(-50%, -50%) rotate(${rand(-18, 18)}deg)`;
  centerImg.addEventListener("pointerdown", onIconPress, { passive: true });
  el.appendChild(centerImg);

  // שאר הסמלים מסביב
  const others = list.slice(1);
  const step = (Math.PI * 2) / others.length;

  // היסט אקראי כדי שלא כל קלף ייראה אותו דבר
  const startAngle = Math.random() * Math.PI * 2;

  others.forEach((symId, i) => {
    const angle = startAngle + i * step;

    // תנודה קטנה ברדיוס כדי שלא יהיה "גיאומטרי מדי"
    const radiusJitter = minSide * 0.018;
    const r = outerRadius + rand(-radiusJitter, radiusJitter);

    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    const img = document.createElement("img");
    img.className = "icon";
    img.src = imageUrlForSymbol(symId);
    img.dataset.symbolId = String(symId);

    const scale = rand(outerScaleMin, outerScaleMax);
    const size = baseSize * scale;

    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.left = `${x}px`;
    img.style.top = `${y}px`;
    img.style.transform = `translate(-50%, -50%) rotate(${rand(-28, 28)}deg)`;

    img.addEventListener("pointerdown", onIconPress, { passive: true });
    el.appendChild(img);
  });
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

  clearCard(el);

  const rect = el.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  const cx = W / 2;
  const cy = H / 2;

  const radius = Math.min(W,H) * 0.35;

  const baseSize = clamp(Math.min(W,H) / 4.2, 48, 80);

  const list = shuffle([...symbols]);

  // --- symbol in the center ---
  const center = list[0];

  const centerImg = document.createElement("img");

  centerImg.className = "icon";
  centerImg.src = imageUrlForSymbol(center);
  centerImg.dataset.symbolId = center;

  const centerSize = baseSize * 1.2;

  centerImg.style.width = centerSize + "px";
  centerImg.style.height = centerSize + "px";

  centerImg.style.left = cx + "px";
  centerImg.style.top = cy + "px";

  centerImg.style.transform = "translate(-50%, -50%)";

  centerImg.addEventListener("pointerdown", onIconPress,{passive:true});

  el.appendChild(centerImg);

  // --- symbols around circle ---

  const others = list.slice(1);
  const step = (Math.PI * 2) / others.length;

  const startAngle = Math.random() * Math.PI * 2;

  others.forEach((sym,i)=>{

    const angle = startAngle + i * step;

    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    const img = document.createElement("img");

    img.className = "icon";
    img.src = imageUrlForSymbol(sym);
    img.dataset.symbolId = sym;

    const size = baseSize * (0.75 + Math.random()*0.4);

    img.style.width = size + "px";
    img.style.height = size + "px";

    img.style.left = x + "px";
    img.style.top = y + "px";

    const rot = (Math.random()*60 - 30).toFixed(1);

    img.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;

    img.addEventListener("pointerdown", onIconPress,{passive:true});

    el.appendChild(img);

  });

}
  clearCard(el);

  const rect = el.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  const cx = W / 2;
  const cy = H / 2;

  // רדיוס פנימי של העיגול (משאיר שוליים כדי לא לגעת במסגרת)
  const circleR = Math.min(W, H) * 0.44;

  // גודל בסיס – נקבע לפי מסך (ואז נייצר וריאציות)
  const base = clamp(Math.min(W, H) / 4.0, 44, 78);

  // ערבוב כדי שכל קלף ייראה שונה
  const list = shuffle([...symbols]);

  // חלוקה לטבעות (מרכז + טבעת פנימית + טבעת חיצונית)
  // זה נותן תחושת “פריסה על כל הקלף” ולא גוש אחד.
  const rings = buildRings(list.length);

  // נבנה “מיקומים” מראש ואז נשבץ אליהם סמלים
  const spots = [];
  let idx = 0;

  for (const ring of rings){
    const count = ring.count;
    const rMin = ring.rMin * circleR;
    const rMax = ring.rMax * circleR;

    // start angle רנדומלי כדי שלא יחזור אותו סידור
    const start = Math.random() * Math.PI * 2;

    for (let k = 0; k < count; k++){
      const t = (k / count) * Math.PI * 2 + start;

      // רדיוס רנדומלי בתוך טווח הטבעת
      const r = rMin + Math.random() * (rMax - rMin);

      // קצת "שבירה" כדי שלא יהיה מושלם מדי
      const jitter = circleR * 0.03;
      const x = cx + r * Math.cos(t) + (Math.random() * 2 - 1) * jitter;
      const y = cy + r * Math.sin(t) + (Math.random() * 2 - 1) * jitter;

      spots.push({ x, y });
    }
  }

  // אם מסיבה כלשהי חסר spots (לא אמור), נוסיף
  while (spots.length < list.length){
    spots.push({ x: cx, y: cy });
  }

  // עכשיו יוצרים אייקונים וממקמים אותם על הנקודות
  for (let i = 0; i < list.length; i++){
    const symId = list[i];
    const spot = spots[i];

    const img = document.createElement("img");
    img.className = "icon";
    img.alt = `symbol-${symId}`;
    img.src = imageUrlForSymbol(symId);
    img.dataset.symbolId = String(symId);

    // גדלים שונים בצורה “נשלטת” (לא קיצוני מדי)
    // אחד-שניים יהיו גדולים, כמה בינוניים, והשאר קטנים/בינוניים.
    const sizeFactor =
      i === 0 ? (1.25 + Math.random() * 0.15) :
      i === 1 ? (1.10 + Math.random() * 0.15) :
      (0.75 + Math.random() * 0.55);

    const size = base * sizeFactor;

    // מרכזים לפי נקודה (x,y)
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.left = `${spot.x}px`;
    img.style.top = `${spot.y}px`;

    // מיקום מהמרכז של האייקון
    img.style.transform = `translate(-50%, -50%) rotate(${(Math.random()*70-35).toFixed(1)}deg)`;

    // מניעת יציאה החוצה: הקלף עגול+overflow hidden עושה כבר את רוב העבודה
    img.addEventListener("pointerdown", onIconPress, { passive: true });

    el.appendChild(img);
    idx++;
  }
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