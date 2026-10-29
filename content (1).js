const WORK_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;
const MAX_ESCAPES = 3;
const MIN_REASON = 15;
const HOLD_MS = 15000;
const APPROVE_CHANCE = 0.2;
const ESCAPE_KEY = "gft-escapes";
const LAST_REASON_KEY = "gft-last-reason";
const KEYBOARD_MASHES = ["asdf", "qwer", "zxcv", "jkl"];
const REASON_ERROR = "That doesn’t look like a real emergency 🤨 — try again";
const APOLOGY =
  "I solemnly apologize to my productivity for abandoning it in its hour of need.";
const HOLD_HINT = "Press and hold SPACEBAR. Let go and it resets.";

const VERDICTS_DENIED = [
  "Your boss emailed? Name three of their hobbies. Exactly. DENIED.",
  "I ran your excuse through 47 neural networks. All 47 laughed. DENIED.",
  "Bold of you to call that an emergency. DENIED.",
  "My sensors detect 0% urgency and 100% boredom. DENIED.",
  "I’ve heard better excuses from a printer that’s ‘out of paper’. DENIED.",
  "Interesting story. Now go tell it to the inbox you’re NOT opening. DENIED.",
  "Have you tried… not checking your email? Revolutionary, I know. DENIED.",
  "The council has reviewed your request. The council said lol. DENIED.",
  "Error 418: I’m a teapot, and even I can tell you’re lying. DENIED.",
  "Your emails will still be there in 20 minutes. So will I. Watching. DENIED.",
  "Emergency level: someone liked your LinkedIn post. DENIED.",
  "I asked your productivity how it feels about this. It’s crying. DENIED.",
];

const VERDICTS_APPROVED = [
  "Reluctantly approved… I’m watching you 👀",
  "Fine. FINE. Approved. But I’m telling your future self.",
  "Approved. Don’t make me regret this (I already do).",
];

const BRAINROT = [
  "{s} is lowkey cooked, they said “{t}” no cap 💀",
  "{s} dropped “{t}” and it’s giving unemployed energy fr",
  "not {s} sending “{t}” 😭 bro thinks he’s the main character",
  "{s} said “{t}”. ohio-level email, skibidi rating 2/10",
  "{s} really typed “{t}” with zero rizz 💀",
  "“{t}” from {s}? that’s an L + ratio + touch grass",
  "{s} is in their villain era: “{t}” 😤",
  "POV: {s} hits you with “{t}” while you’re on break 🧍",
  "{s} sent “{t}”… it’s giving NPC behavior fr fr",
  "{s} with “{t}”. sigma move or total flop? (flop)",
  "breaking news: {s} said “{t}”. nobody asked. delulu.",
  "{s} chose violence today: “{t}” 🔥 the aura loss is crazy",
];

const STEP_NUMBERS = { reason: 1, judging: 1, verdict: 1, apology: 2, math: 3, hold: 4 };

let mode = "work";
let remainingMs = WORK_MS;
let running = false;
let escaped = false;
let lastTick = 0;
let intervalId = null;
let saveTimeout = null;

let escapeStep = null;
let judgeTimeout = null;
let verdictApproved = false;
let mathAnswer = 0;
let holding = false;
let holdStart = 0;
let holdRaf = null;
let brainrotTimeout = null;

/* ---------- helpers ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function loadEscapes() {
  try {
    const data = JSON.parse(localStorage.getItem(ESCAPE_KEY) || "null");
    if (!data || data.date !== todayKey()) return { date: todayKey(), count: 0 };
    return { date: data.date, count: Number(data.count) || 0 };
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function escapesLeft() {
  return Math.max(0, MAX_ESCAPES - loadEscapes().count);
}

function recordEscape() {
  const data = loadEscapes();
  try {
    localStorage.setItem(ESCAPE_KEY, JSON.stringify({ date: todayKey(), count: data.count + 1 }));
  } catch {}
}

function lastReason() {
  try {
    return localStorage.getItem(LAST_REASON_KEY) || "";
  } catch {
    return "";
  }
}

function reasonIsValid(reason) {
  if (reason.length < MIN_REASON) return false;

  const words = reason.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  if (/(.)\1{3,}/.test(reason)) return false;
  if (reason === lastReason()) return false;

  const lower = reason.toLowerCase();
  if (KEYBOARD_MASHES.some((mash) => lower.includes(mash))) return false;

  return words.every((word) => {
    const letters = word.replace(/[^a-zA-Z]/g, "");
    return !letters || /[aeiouy]/i.test(letters);
  });
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/* ---------- timer ---------- */

function render() {
  const time = formatTime(remainingMs);
  const total = mode === "break" ? BREAK_MS : WORK_MS;
  const ratio = Math.max(0, Math.min(1, remainingMs / total));
  timeEl.textContent = time;
  labelEl.textContent = mode === "break" ? "☕ Break" : "🔒 Focus";
  progressCircle.setAttribute("stroke-dashoffset", String(RING_C * (1 - ratio)));
  progressCircle.setAttribute(
    "stroke",
    mode === "break" ? "url(#gft-grad-break)" : "url(#gft-grad-focus)"
  );
  overlayMessage.textContent = `You’re Out of Office 🔒 — back in ${time}`;
  overlay.classList.toggle("gft-visible", mode === "work" && running && !escaped);
  overlay.classList.toggle("gft-no-escapes", escapesLeft() <= 0);
  root.classList.toggle("gft-break", mode === "break");
  root.classList.toggle("gft-pulse", running && remainingMs > 0 && remainingMs <= 10000);
  root.classList.toggle("gft-idle", !running);
}

function enterBreak() {
  mode = "break";
  remainingMs = BREAK_MS;
  escaped = false;
  lastTick = Date.now();
  closeEscapeDialog();
  showBrainrot();
}

function enterWork() {
  mode = "work";
  remainingMs = WORK_MS;
  escaped = false;
  lastTick = Date.now();
  hideBrainrot();
}

function tick() {
  const now = Date.now();
  remainingMs -= now - lastTick;
  lastTick = now;

  if (remainingMs <= 0) {
    if (mode === "work") {
      enterBreak();
    } else {
      enterWork();
    }
  }

  render();
}

function start() {
  if (running) return;
  running = true;
  lastTick = Date.now();
  intervalId = setInterval(tick, 250);
  render();
}

function skipToDemo() {
  remainingMs = 5000;
  lastTick = Date.now();
  render();
}

// Hidden shortcut: Shift + R resets today's escapes
let toastTimeout = null;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("gft-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastEl.classList.remove("gft-visible"), 2000);
}

function resetEscapes() {
  try {
    localStorage.removeItem(ESCAPE_KEY);
    localStorage.removeItem(LAST_REASON_KEY);
  } catch {}
  render();
  showToast(`Escapes reset ✅ ${MAX_ESCAPES} left`);
}

/* ---------- escape gauntlet ---------- */

function setStep(step) {
  escapeStep = step;
  dialog.dataset.step = step;
  stepLabel.textContent = `Step ${STEP_NUMBERS[step]} of 4`;

  if (step === "reason") {
    reasonInput.focus();
  } else if (step === "apology") {
    apologyInput.focus();
  } else if (step === "math") {
    mathInput.focus();
  } else if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function openEscapeDialog() {
  if (escapesLeft() <= 0) return;
  closeEscapeDialog();
  overlay.classList.remove("gft-saved");
  clearTimeout(saveTimeout);
  leftEl.textContent = `Escapes left today: ${escapesLeft()}`;
  newMathProblem();
  mathError.hidden = true;
  dialog.classList.add("gft-visible");
  setStep("reason");
}

function closeEscapeDialog() {
  clearTimeout(judgeTimeout);
  judgeTimeout = null;
  stopHold(false);
  escapeStep = null;
  dialog.classList.remove("gft-visible");
  delete dialog.dataset.step;

  reasonInput.value = "";
  apologyInput.value = "";
  mathInput.value = "";
  reasonContinue.disabled = true;
  apologyContinue.disabled = true;
  reasonError.hidden = true;
  mathError.hidden = true;
  apologyStatus.textContent = "";
  holdFill.style.width = "0%";
  holdMsg.textContent = HOLD_HINT;
}

function showNiceSave() {
  overlay.classList.add("gft-saved");
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => overlay.classList.remove("gft-saved"), 2000);
}

function abortEscape() {
  closeEscapeDialog();
  showNiceSave();
}

function finishEscape() {
  recordEscape();
  escaped = true;
  closeEscapeDialog();
  render();
}

// Step 1: reason
function updateReasonEnabled() {
  const reason = reasonInput.value;
  const valid = reasonIsValid(reason);
  reasonContinue.disabled = !valid;
  reasonError.hidden = valid || reason.length === 0;
}

function submitReason() {
  const reason = reasonInput.value;
  if (!reasonIsValid(reason)) return;
  try {
    localStorage.setItem(LAST_REASON_KEY, reason);
  } catch {}
  setStep("judging");
  judgeTimeout = setTimeout(() => showVerdict(false), 3000);
}

// Step 1b: the AI Judge
function showVerdict(forceApprove) {
  clearTimeout(judgeTimeout);
  judgeTimeout = null;
  verdictApproved = forceApprove || Math.random() < APPROVE_CHANCE;
  verdictCard.classList.toggle("gft-approved", verdictApproved);
  verdictStamp.textContent = verdictApproved ? "APPROVED" : "DENIED";
  verdictText.textContent = pick(verdictApproved ? VERDICTS_APPROVED : VERDICTS_DENIED);
  verdictBtn.textContent = verdictApproved ? "Continue to step 2 →" : "Back to jail 🔒";
  setStep("verdict");
}

function handleVerdictButton() {
  if (verdictApproved) {
    setStep("apology");
  } else {
    closeEscapeDialog();
  }
}

// Step 2: apology
function updateApology() {
  const typed = apologyInput.value;
  const done = typed.trim() === APOLOGY;
  apologyContinue.disabled = !done;

  if (!typed) {
    apologyStatus.textContent = "";
  } else if (done) {
    apologyStatus.textContent = "✅ Your productivity accepts your apology.";
  } else if (APOLOGY.startsWith(typed)) {
    apologyStatus.textContent = "Keep going…";
  } else {
    apologyStatus.textContent = "❌ Typo detected. Your productivity is not impressed.";
  }
}

// Step 3: math
function newMathProblem() {
  const a = randInt(12, 99);
  const b = randInt(12, 99);
  mathAnswer = a * b;
  mathProblem.textContent = `${a} × ${b} = ?`;
  mathInput.value = "";
}

function submitMath() {
  const answer = Number(mathInput.value.trim());
  if (mathInput.value.trim() !== "" && answer === mathAnswer) {
    setStep("hold");
    return;
  }
  mathError.hidden = false;
  mathError.textContent = "Wrong. New problem, Einstein 🧮";
  newMathProblem();
  mathInput.focus();
}

// Step 4: hold the spacebar
function startHold() {
  if (holding) return;
  holding = true;
  holdStart = performance.now();
  holdMsg.textContent = "Keep holding… don’t you dare let go 😤";
  holdRaf = requestAnimationFrame(updateHold);
}

function updateHold(now) {
  if (!holding) return;
  const progress = Math.min(1, (now - holdStart) / HOLD_MS);
  holdFill.style.width = `${progress * 100}%`;

  if (progress >= 1) {
    holding = false;
    finishEscape();
    return;
  }
  holdRaf = requestAnimationFrame(updateHold);
}

function stopHold(showReset) {
  const wasHolding = holding;
  holding = false;
  cancelAnimationFrame(holdRaf);
  holdRaf = null;
  holdFill.style.width = "0%";
  if (showReset && wasHolding) {
    holdMsg.textContent = "You let go. Back to 0 😈";
  }
}

// Hidden demo shortcut: Shift + S
function skipGauntletStep() {
  if (escapeStep === "judging" || escapeStep === "verdict") {
    showVerdict(true);
    return true;
  }
  if (escapeStep === "hold") {
    stopHold(false);
    finishEscape();
    return true;
  }
  return false;
}

/* ---------- brainrot break summary ---------- */

function readInbox() {
  const rows = Array.from(document.querySelectorAll("tr.zA")).slice(0, 8);
  return rows
    .map((row) => {
      const senderEl = row.querySelector("span.zF, span.yP, span[email]");
      const subjectEl = row.querySelector("span.bog");
      const sender = (senderEl?.getAttribute("name") || senderEl?.textContent || "Someone").trim();
      const subject = (subjectEl?.textContent || "").trim();
      return { sender, subject: subject || "(no subject)" };
    })
    .filter((email) => email.sender);
}

function showBrainrot() {
  clearTimeout(brainrotTimeout);
  brainrotList.replaceChildren();
  brainrotPanel.classList.add("gft-visible", "gft-cooking");

  brainrotTimeout = setTimeout(() => {
    brainrotPanel.classList.remove("gft-cooking");
    const emails = readInbox();

    if (!emails.length) {
      brainrotList.append(el("li", "", "Your inbox is empty. Go touch grass 🌱"));
      return;
    }

    const templates = shuffle(BRAINROT);
    emails.forEach((email, i) => {
      const line = templates[i % templates.length]
        .replace("{s}", () => email.sender)
        .replace("{t}", () => email.subject);
      brainrotList.append(el("li", "", line));
    });
  }, 2200);
}

function hideBrainrot() {
  clearTimeout(brainrotTimeout);
  brainrotPanel.classList.remove("gft-visible", "gft-cooking");
}

/* ---------- dragging ---------- */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeDraggable(node) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  node.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;

    const rect = node.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    dragging = true;
    node.classList.add("gft-dragging");
    node.setPointerCapture(event.pointerId);
  });

  node.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    const x = clamp(event.clientX - offsetX, 0, window.innerWidth - node.offsetWidth);
    const y = clamp(event.clientY - offsetY, 0, window.innerHeight - node.offsetHeight);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.right = "auto";
    node.style.bottom = "auto";
  });

  node.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    node.classList.remove("gft-dragging");
    node.releasePointerCapture(event.pointerId);
  });
}

/* ---------- build the jail overlay ---------- */

const overlay = el("div");
overlay.id = "gft-overlay";

const overlayMessage = el("div", "gft-message");

const escapeBtn = el("button", "gft-escape", "Emergency escape");
escapeBtn.addEventListener("click", openEscapeDialog);

const escapeGone = el("div", "gft-escape-gone", "No escapes left. You’ve got this 💪");
const saveEl = el("div", "gft-save", "Nice save 💪");

overlay.append(overlayMessage, saveEl, escapeBtn, escapeGone);

/* ---------- build the gauntlet dialog ---------- */

const dialog = el("div");
dialog.id = "gft-dialog";

const card = el("div", "gft-card");
const stepLabel = el("div", "gft-steplabel");

// Step 1: reason
const stepReason = el("div", "gft-step gft-step-reason");
const reasonInput = el("textarea");
reasonInput.placeholder = "Describe the emergency";
reasonInput.addEventListener("input", updateReasonEnabled);
const reasonError = el("div", "gft-error", REASON_ERROR);
reasonError.hidden = true;
const leftEl = el("div", "gft-left");
const reasonContinue = el("button", "gft-primary", "Submit to the AI Judge ⚖️");
reasonContinue.disabled = true;
reasonContinue.addEventListener("click", submitReason);
stepReason.append(el("h2", "", "What’s the emergency?"), reasonInput, reasonError, leftEl, reasonContinue);

// Step 1b: judging
const stepJudging = el("div", "gft-step gft-step-judging");
stepJudging.append(
  el("div", "gft-spinner"),
  el("div", "gft-judging-title", "🤖 AI Judge is analyzing your excuse…"),
  el("div", "gft-judging-sub", "Consulting 47 neural networks and one very tired lawyer")
);

// Step 1c: verdict
const stepVerdict = el("div", "gft-step gft-step-verdict");
const verdictCard = el("div", "gft-verdict");
const verdictStamp = el("div", "gft-stamp");
const verdictText = el("div", "gft-verdict-text");
verdictCard.append(el("div", "gft-judge-name", "⚖️ AI Judge v6.9"), verdictStamp, verdictText);
const verdictBtn = el("button", "gft-primary");
verdictBtn.addEventListener("click", handleVerdictButton);
stepVerdict.append(verdictCard, verdictBtn);

// Step 2: apology
const stepApology = el("div", "gft-step gft-step-apology");
const apologyInput = el("textarea");
apologyInput.placeholder = "Type it exactly. No pasting.";
apologyInput.addEventListener("input", updateApology);
apologyInput.addEventListener("paste", (event) => {
  event.preventDefault();
  apologyStatus.textContent = "Nice try. No pasting 🙂";
});
apologyInput.addEventListener("drop", (event) => event.preventDefault());
const apologyStatus = el("div", "gft-status");
const apologyContinue = el("button", "gft-primary", "Continue to step 3 →");
apologyContinue.disabled = true;
apologyContinue.addEventListener("click", () => setStep("math"));
stepApology.append(
  el("h2", "", "Apologize to your productivity"),
  el("div", "gft-quote", APOLOGY),
  apologyInput,
  apologyStatus,
  apologyContinue
);

// Step 3: math
const stepMath = el("div", "gft-step gft-step-math");
const mathProblem = el("div", "gft-math-problem");
const mathInput = el("input");
mathInput.type = "text";
mathInput.inputMode = "numeric";
mathInput.placeholder = "Your answer";
mathInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitMath();
});
const mathError = el("div", "gft-error");
mathError.hidden = true;
const mathSubmit = el("button", "gft-primary", "Check answer");
mathSubmit.addEventListener("click", submitMath);
stepMath.append(
  el("h2", "", "Prove your brain still works"),
  el("div", "gft-hint", "No calculator. We’re watching. 👀"),
  mathProblem,
  mathInput,
  mathError,
  mathSubmit
);

// Step 4: hold
const stepHold = el("div", "gft-step gft-step-hold");
const holdBar = el("div", "gft-hold-bar");
const holdFill = el("div", "gft-hold-fill");
holdBar.append(holdFill);
const holdMsg = el("div", "gft-hint", HOLD_HINT);
stepHold.append(
  el("h2", "", "Final step: commitment"),
  el("div", "gft-hold-big", "Hold SPACEBAR for 15 seconds"),
  holdBar,
  holdMsg
);

const nevermindBtn = el("button", "gft-nevermind", "Never mind, back to focus");
nevermindBtn.addEventListener("click", abortEscape);

card.append(stepLabel, stepReason, stepJudging, stepVerdict, stepApology, stepMath, stepHold, nevermindBtn);
dialog.append(card);

/* ---------- build the brainrot panel ---------- */

const brainrotPanel = el("div");
brainrotPanel.id = "gft-brainrot";
const brainrotList = el("ul", "gft-brainrot-list");
const brainrotClose = el("button", "gft-brainrot-close", "ok bestie 💅");
brainrotClose.addEventListener("click", hideBrainrot);
brainrotPanel.append(
  el("div", "gft-brainrot-title", "📱 Your inbox, brainrot edition"),
  el("div", "gft-brainrot-cooking", "Skibidi-GPT is cooking… 🍳"),
  brainrotList,
  el("div", "gft-brainrot-footer", "Powered by Skibidi-GPT 9000"),
  brainrotClose
);

/* ---------- build the timer widget ---------- */

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

function svgEl(name, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

const root = el("div");
root.id = "gft-timer";

const labelEl = el("div", "gft-label");
const ring = el("div", "gft-ring");

const svg = svgEl("svg", { class: "gft-ring-svg", viewBox: "0 0 120 120" });
const defs = svgEl("defs", {});
const focusGrad = svgEl("linearGradient", { id: "gft-grad-focus", x1: "0%", y1: "0%", x2: "100%", y2: "100%" });
focusGrad.append(
  svgEl("stop", { offset: "0%", "stop-color": "#a855f7" }),
  svgEl("stop", { offset: "100%", "stop-color": "#fb7185" })
);
const breakGrad = svgEl("linearGradient", { id: "gft-grad-break", x1: "0%", y1: "0%", x2: "100%", y2: "100%" });
breakGrad.append(
  svgEl("stop", { offset: "0%", "stop-color": "#22c55e" }),
  svgEl("stop", { offset: "100%", "stop-color": "#14b8a6" })
);
defs.append(focusGrad, breakGrad);

const trackCircle = svgEl("circle", { class: "gft-ring-track", cx: "60", cy: "60", r: String(RING_R) });
const progressCircle = svgEl("circle", {
  class: "gft-ring-progress",
  cx: "60",
  cy: "60",
  r: String(RING_R),
  "stroke-dasharray": String(RING_C),
  "stroke-dashoffset": "0",
  stroke: "url(#gft-grad-focus)",
});
svg.append(defs, trackCircle, progressCircle);

const timeEl = el("span", "gft-time");
ring.append(svg, timeEl);

const actions = el("div", "gft-actions");
const startBtn = el("button", "", "Start focus");
startBtn.addEventListener("click", start);
actions.append(startBtn);

root.append(labelEl, ring, actions);

const toastEl = el("div");
toastEl.id = "gft-toast";

document.documentElement.append(overlay, dialog, brainrotPanel, root, toastEl);
makeDraggable(root);

/* ---------- keyboard ---------- */

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.closest("input, textarea, select") || target.isContentEditable)
  );
}

window.addEventListener(
  "keydown",
  (event) => {
    if (escapeStep === "hold" && (event.code === "Space" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) startHold();
      return;
    }

    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !event.shiftKey) return;
    if (isTypingTarget(event.target)) return;

    const key = event.key.toLowerCase();
    if (key === "d") {
      event.preventDefault();
      event.stopPropagation();
      skipToDemo();
    } else if (key === "r") {
      event.preventDefault();
      event.stopPropagation();
      resetEscapes();
    } else if (key === "s" && skipGauntletStep()) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true
);

window.addEventListener(
  "keyup",
  (event) => {
    if (escapeStep === "hold" && (event.code === "Space" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      stopHold(true);
    }
  },
  true
);

window.addEventListener("blur", () => stopHold(true));

render();
