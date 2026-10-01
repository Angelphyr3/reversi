// Draws the game and handles clicks, taps and keys. All rules live in game.js and the computer
// opponent in ai.js — this file only asks them what to do and shows the result. Text is always
// set with textContent, never innerHTML (see "Security" in PLAN.md).
(() => {
  "use strict";

  const { SIZE, BLACK, WHITE } = Reversi;
  const COMPUTER = WHITE; // the person always plays black and moves first
  const COLUMNS = "ABCDEFGH";
  const TOAST_MS = 2600;
  const FLIP_MS = 380; // keep in sync with --flip-ms in styles.css
  const RIPPLE_MS = 70; // extra delay per square of distance from the placed disc
  const THINK_MS = 650; // pause before the computer moves, so players can follow along
  const ANIMATION_CLASSES = ["pop", "flip-to-black", "flip-to-white"];
  const SETTINGS_KEY = "reversi-settings";
  const PALETTE_KEY = "reversi-palette";
  const MODES = ["two", "computer"];
  const HINTS = ["show", "hide"];
  const LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };

  const $ = (id) => document.getElementById(id);
  const appEl = document.querySelector(".app");
  const boardEl = $("board");
  const nameEls = { [BLACK]: $("name-black"), [WHITE]: $("name-white") };
  const scoreEls = { [BLACK]: $("score-black"), [WHITE]: $("score-white") };
  const countEls = { [BLACK]: $("count-black"), [WHITE]: $("count-white") };
  const turnEl = document.querySelector(".turn");
  const turnDisc = $("turn-disc");
  const turnText = $("turn-text");
  const toastEl = $("toast");
  const bannerEl = $("banner");
  const bannerTitle = $("banner-title");
  const bannerScore = $("banner-score");
  const playAgainBtn = $("play-again");
  const changeGameBtn = $("change-game");
  const newGameBtn = $("new-game");
  const muteBtn = $("mute");
  const paletteBtn = $("palette");
  const setupEl = $("setup");
  const levelChoice = $("level-choice");
  const hintsChoice = $("hints-choice");
  const setupNote = $("setup-note");
  const setupCancel = $("setup-cancel");
  const setupStart = $("setup-start");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const cells = []; // index = row * SIZE + col
  let settings = loadSettings(); // what the setup card shows; becomes `game` when a game starts
  let game = settings; // the opponent and difficulty for the game being played
  let state;
  let focusIndex = 0; // the one board square reachable with Tab; arrows move it
  let toastTimer = null;
  let announceTimer = null; // waits for animations to finish before a pass message or the banner
  let computerTimer = null;

  // ---------- Settings (remembered in this browser) ----------

  function loadSettings() {
    const fallback = { mode: "computer", level: "medium", hints: "show" };
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      // Only accept known values — never trust what's in storage.
      return {
        mode: MODES.includes(saved?.mode) ? saved.mode : fallback.mode,
        level: ReversiAI.LEVELS.includes(saved?.level) ? saved.level : fallback.level,
        hints: HINTS.includes(saved?.hints) ? saved.hints : fallback.hints,
      };
    } catch {
      return fallback;
    }
  }

  // The color-blind board is a display preference for this browser, separate from game settings.
  function loadPalette() {
    try {
      return localStorage.getItem(PALETTE_KEY) === "colorblind";
    } catch {
      return false;
    }
  }

  function setPalette(colorblind) {
    if (colorblind) document.documentElement.dataset.palette = "colorblind";
    else delete document.documentElement.dataset.palette;
    paletteBtn.setAttribute("aria-pressed", String(colorblind));
    paletteBtn.title = colorblind ? "Color-blind friendly board: on" : "Color-blind friendly board: off";
    try {
      localStorage.setItem(PALETTE_KEY, colorblind ? "colorblind" : "standard");
    } catch {
      // not remembered this time; harmless
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // not remembered this time; harmless
    }
  }

  // ---------- Who's playing ----------

  const vsComputer = () => game.mode === "computer";
  const computersTurn = () => vsComputer() && !state.gameOver && state.currentPlayer === COMPUTER;

  function nameOf(player) {
    if (player === BLACK) return "Player 1";
    return vsComputer() ? "Computer" : "Player 2";
  }

  // ---------- Drawing ----------

  function buildBoard() {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.index = row * SIZE + col;
        const disc = document.createElement("span");
        disc.className = "disc";
        button.append(disc);
        boardEl.append(button);
        cells.push({ button, disc });
      }
    }
    for (const corner of ["tl", "tr", "bl", "br"]) {
      const star = document.createElement("span");
      star.className = `star star-${corner}`;
      boardEl.append(star);
    }
  }

  function cellLabel(row, col, color, legal) {
    const square = `${COLUMNS[col]}${row + 1}`;
    if (color) return `${square}, ${nameOf(color)}`;
    return legal ? `${square}, empty, legal move` : `${square}, empty`;
  }

  function render() {
    const waiting = computersTurn();
    // Hints show the person's moves only — never the computer's — and two players can turn
    // them off in the setup card.
    const showHints = !waiting && (vsComputer() || game.hints === "show");
    const legal = new Set(showHints ? state.validMoves.map(([r, c]) => r * SIZE + c) : []);

    cells.forEach(({ button, disc }, i) => {
      const row = Math.floor(i / SIZE);
      const col = i % SIZE;
      const color = state.board[row][col];
      disc.dataset.color = color || "";
      button.classList.toggle("legal", legal.has(i));
      button.setAttribute("aria-label", cellLabel(row, col, color, legal.has(i)));
      button.tabIndex = i === focusIndex ? 0 : -1;
    });
    boardEl.dataset.turn = state.currentPlayer;
    boardEl.classList.toggle("waiting", waiting);

    for (const player of [BLACK, WHITE]) {
      nameEls[player].textContent = nameOf(player);
      scoreEls[player].classList.toggle("active", !state.gameOver && state.currentPlayer === player);
    }
    countEls[BLACK].textContent = state.blackCount;
    countEls[WHITE].textContent = state.whiteCount;
    countEls[BLACK].setAttribute("aria-label", `${nameOf(BLACK)}: ${state.blackCount} discs`);
    countEls[WHITE].setAttribute("aria-label", `${nameOf(WHITE)}: ${state.whiteCount} discs`);

    turnEl.classList.toggle("thinking", waiting);
    if (state.gameOver) {
      turnDisc.dataset.color = "";
      turnText.textContent = "Game over";
    } else if (waiting) {
      turnDisc.dataset.color = COMPUTER;
      turnText.textContent = "Computer is thinking…";
    } else {
      turnDisc.dataset.color = state.currentPlayer;
      turnText.textContent = `${nameOf(state.currentPlayer)}'s turn`;
    }
  }

  // Plays the placement and flip animations and their sounds, comparing the board before and
  // after the move. Returns how long (ms) until everything has settled.
  function animateMove(before, row, col) {
    const placed = row * SIZE + col;
    const player = state.board[row][col];
    Sound.place();

    const flipped = [];
    cells.forEach((_, i) => {
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      if (i !== placed && before[r][c] !== state.board[r][c]) {
        flipped.push({ i, distance: Math.max(Math.abs(r - row), Math.abs(c - col)) });
      }
    });
    flipped.sort((a, b) => a.distance - b.distance);

    const motion = !reduceMotion.matches;
    if (motion) startAnimation(cells[placed].disc, "pop", 0);

    let settle = 0;
    flipped.forEach(({ i, distance }, order) => {
      const delay = motion ? 120 + (distance - 1) * RIPPLE_MS : 0;
      if (motion) startAnimation(cells[i].disc, `flip-to-${player}`, delay);
      Sound.flip(order, delay + (motion ? FLIP_MS / 2 : 60 * order));
      settle = Math.max(settle, delay + FLIP_MS);
    });
    return motion ? settle : 0;
  }

  function startAnimation(disc, name, delayMs) {
    disc.classList.remove(...ANIMATION_CLASSES);
    void disc.offsetWidth; // restart even if the same animation is still running
    disc.style.setProperty("--delay", `${delayMs}ms`);
    disc.classList.add(name);
  }

  // ---------- Moves ----------

  // A person's click or tap. Illegal squares shake; clicks during the computer's turn are ignored.
  function play(index) {
    if (computersTurn()) return;
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    if (!Reversi.isValidMove(state.board, row, col, state.currentPlayer) || state.gameOver) {
      if (!state.gameOver && state.board[row][col] === null) {
        shake(cells[index].button);
        Sound.invalid();
      }
      return;
    }
    makeMove(row, col);
  }

  function makeMove(row, col) {
    const before = state.board;
    state = Reversi.playTurn(state, row, col);
    render();
    const settleMs = animateMove(before, row, col);
    announce(settleMs);
    // If the person just had to pass, give them a moment to read the message first.
    scheduleComputer(settleMs + (state.passed ? TOAST_MS / 2 : 0));
  }

  function scheduleComputer(afterMs) {
    clearTimeout(computerTimer);
    if (!computersTurn()) return;
    computerTimer = setTimeout(() => {
      const move = ReversiAI.chooseMove(state, game.level);
      if (move) makeMove(move[0], move[1]);
    }, afterMs + THINK_MS);
  }

  // Once the flips have finished: tell players about a forced pass, or show the result.
  function announce(delayMs) {
    clearTimeout(announceTimer);
    if (!state.passed && !state.gameOver) return;
    announceTimer = setTimeout(() => {
      if (state.gameOver) {
        Sound.gameOver(state.winner === "draw");
        showBanner();
      } else {
        Sound.pass();
        showToast(`${nameOf(state.passed)} has no moves — ${nameOf(state.currentPlayer)} goes again!`);
      }
    }, delayMs);
  }

  function shake(button) {
    button.classList.remove("nope");
    void button.offsetWidth;
    button.classList.add("nope");
  }

  // ---------- Messages ----------

  function showToast(text) {
    clearTimeout(toastTimer);
    toastEl.textContent = text;
    toastEl.hidden = false;
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toastEl.hidden = true;
  }

  function showBanner() {
    hideToast();
    if (state.winner === "draw") {
      bannerTitle.textContent = "It's a draw!";
    } else if (vsComputer()) {
      bannerTitle.textContent = state.winner === COMPUTER ? "The computer wins!" : "You win! 🎉";
    } else {
      bannerTitle.textContent = `${nameOf(state.winner)} wins!`;
    }
    const whiteName = vsComputer() ? `${nameOf(WHITE)} (${LEVEL_NAMES[game.level]})` : nameOf(WHITE);
    bannerScore.textContent = `${nameOf(BLACK)} ${state.blackCount} – ${state.whiteCount} ${whiteName}`;
    bannerEl.hidden = false;
    boardEl.inert = true;
    playAgainBtn.focus();
  }

  // ---------- Starting games ----------

  function newGame() {
    hideToast();
    clearTimeout(announceTimer);
    clearTimeout(computerTimer);
    bannerEl.hidden = true;
    boardEl.inert = false;
    for (const { disc } of cells) disc.classList.remove(...ANIMATION_CLASSES);
    game = { ...settings };
    state = Reversi.createGame();
    const [row, col] = state.validMoves[0];
    focusIndex = row * SIZE + col;
    render();
  }

  function gameInProgress() {
    return state && !state.gameOver && state.blackCount + state.whiteCount > 4;
  }

  function openSetup() {
    clearTimeout(computerTimer); // the computer waits while the menu is open
    for (const input of setupEl.querySelectorAll("input")) {
      input.checked = input.value === settings[input.name];
    }
    showSetupChoices();
    setupCancel.hidden = !gameInProgress();
    bannerEl.hidden = true;
    setupEl.hidden = false;
    appEl.inert = true;
    setupEl.querySelector('input[name="mode"]:checked').focus();
  }

  function closeSetup() {
    setupEl.hidden = true;
    appEl.inert = false;
  }

  function showSetupChoices() {
    const mode = setupEl.querySelector('input[name="mode"]:checked').value;
    levelChoice.hidden = mode !== "computer";
    hintsChoice.hidden = mode === "computer";
    setupNote.textContent =
      mode === "computer" ? "You play black and go first." : "Take turns on this device. Black goes first.";
  }

  function onSetupStart() {
    settings = {
      mode: setupEl.querySelector('input[name="mode"]:checked').value,
      level: setupEl.querySelector('input[name="level"]:checked').value,
      hints: setupEl.querySelector('input[name="hints"]:checked').value,
    };
    saveSettings();
    closeSetup();
    newGame();
    cells[focusIndex].button.focus();
  }

  function onSetupCancel() {
    closeSetup();
    scheduleComputer(0);
    newGameBtn.focus();
  }

  // ---------- Input ----------

  const ARROW_STEPS = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };

  function onBoardKey(event) {
    const step = ARROW_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const row = Math.min(SIZE - 1, Math.max(0, Math.floor(focusIndex / SIZE) + step[0]));
    const col = Math.min(SIZE - 1, Math.max(0, (focusIndex % SIZE) + step[1]));
    cells[focusIndex].button.tabIndex = -1;
    focusIndex = row * SIZE + col;
    cells[focusIndex].button.tabIndex = 0;
    cells[focusIndex].button.focus();
  }

  function onBoardClick(event) {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    focusIndex = Number(cell.dataset.index);
    play(focusIndex);
  }

  // Clear finished animation classes so the next flip of the same disc starts fresh.
  function onAnimationEnd(event) {
    if (event.target.classList.contains("disc")) {
      event.target.classList.remove(...ANIMATION_CLASSES);
    }
  }

  function showMuted() {
    const muted = Sound.isMuted();
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.title = muted ? "Sound off" : "Sound on";
  }

  boardEl.addEventListener("click", onBoardClick);
  boardEl.addEventListener("keydown", onBoardKey);
  boardEl.addEventListener("animationend", onAnimationEnd);
  newGameBtn.addEventListener("click", openSetup);
  changeGameBtn.addEventListener("click", openSetup);
  playAgainBtn.addEventListener("click", () => {
    newGame();
    cells[focusIndex].button.focus();
  });
  paletteBtn.addEventListener("click", () => {
    setPalette(paletteBtn.getAttribute("aria-pressed") !== "true");
  });
  muteBtn.addEventListener("click", () => {
    Sound.setMuted(!Sound.isMuted());
    showMuted();
  });
  setupEl.addEventListener("change", showSetupChoices);
  setupStart.addEventListener("click", onSetupStart);
  setupCancel.addEventListener("click", onSetupCancel);
  setupEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !setupCancel.hidden) onSetupCancel();
  });

  setPalette(loadPalette());
  buildBoard();
  showMuted();
  newGame();
  openSetup();
})();
