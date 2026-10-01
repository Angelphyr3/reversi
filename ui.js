// Draws the game and handles clicks, taps and keys. All rules live in game.js — this file only
// asks it what's legal and shows the result. Text is always set with textContent, never
// innerHTML (see "Security" in PLAN.md).
(() => {
  "use strict";

  const { SIZE, BLACK, WHITE } = Reversi;
  const NAMES = { [BLACK]: "Player 1", [WHITE]: "Player 2" };
  const COLUMNS = "ABCDEFGH";
  const TOAST_MS = 2600;
  const CONFIRM_MS = 3000;
  const FLIP_MS = 380; // keep in sync with --flip-ms in styles.css
  const RIPPLE_MS = 70; // extra delay per square of distance from the placed disc
  const ANIMATION_CLASSES = ["pop", "flip-to-black", "flip-to-white"];

  const $ = (id) => document.getElementById(id);
  const boardEl = $("board");
  const scoreEls = { [BLACK]: $("score-black"), [WHITE]: $("score-white") };
  const countEls = { [BLACK]: $("count-black"), [WHITE]: $("count-white") };
  const turnDisc = $("turn-disc");
  const turnText = $("turn-text");
  const toastEl = $("toast");
  const bannerEl = $("banner");
  const bannerTitle = $("banner-title");
  const bannerScore = $("banner-score");
  const playAgainBtn = $("play-again");
  const newGameBtn = $("new-game");
  const muteBtn = $("mute");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const cells = []; // index = row * SIZE + col
  let state;
  let focusIndex = 0; // the one board square reachable with Tab; arrows move it
  let toastTimer = null;
  let confirmTimer = null;
  let announceTimer = null; // waits for animations to finish before a pass message or the banner

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
    if (color) return `${square}, ${NAMES[color]}`;
    return legal ? `${square}, empty, legal move` : `${square}, empty`;
  }

  function render() {
    const legal = new Set(state.validMoves.map(([r, c]) => r * SIZE + c));

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

    for (const player of [BLACK, WHITE]) {
      scoreEls[player].classList.toggle("active", !state.gameOver && state.currentPlayer === player);
    }
    countEls[BLACK].textContent = state.blackCount;
    countEls[WHITE].textContent = state.whiteCount;

    if (state.gameOver) {
      turnDisc.dataset.color = "";
      turnText.textContent = "Game over";
    } else {
      turnDisc.dataset.color = state.currentPlayer;
      turnText.textContent = `${NAMES[state.currentPlayer]}'s turn`;
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

  function play(index) {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const next = Reversi.playTurn(state, row, col);
    if (next === state) {
      if (!state.gameOver && state.board[row][col] === null) {
        shake(cells[index].button);
        Sound.invalid();
      }
      return;
    }
    const before = state.board;
    state = next;
    render();
    const settleMs = animateMove(before, row, col);
    announce(settleMs);
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
        showToast(`${NAMES[state.passed]} has no moves — ${NAMES[state.currentPlayer]} goes again!`);
      }
    }, delayMs);
  }

  function shake(button) {
    button.classList.remove("nope");
    void button.offsetWidth;
    button.classList.add("nope");
  }

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
    bannerTitle.textContent =
      state.winner === "draw" ? "It's a draw!" : `${NAMES[state.winner]} wins!`;
    bannerScore.textContent =
      `${NAMES[BLACK]} ${state.blackCount} – ${state.whiteCount} ${NAMES[WHITE]}`;
    bannerEl.hidden = false;
    playAgainBtn.focus();
  }

  function newGame() {
    resetConfirm();
    hideToast();
    clearTimeout(announceTimer);
    bannerEl.hidden = true;
    for (const { disc } of cells) disc.classList.remove(...ANIMATION_CLASSES);
    state = Reversi.createGame();
    const [row, col] = state.validMoves[0];
    focusIndex = row * SIZE + col;
    render();
  }

  // There's no undo, so restarting mid-game asks for a second tap first.
  function onNewGameClick() {
    const inProgress = !state.gameOver && state.blackCount + state.whiteCount > 4;
    if (inProgress && !newGameBtn.classList.contains("confirming")) {
      newGameBtn.classList.add("confirming");
      newGameBtn.textContent = "Tap again";
      newGameBtn.setAttribute("aria-label", "Tap again to restart the game");
      confirmTimer = setTimeout(resetConfirm, CONFIRM_MS);
      return;
    }
    newGame();
  }

  function resetConfirm() {
    clearTimeout(confirmTimer);
    newGameBtn.classList.remove("confirming");
    newGameBtn.textContent = "New game";
    newGameBtn.removeAttribute("aria-label");
  }

  function showMuted() {
    const muted = Sound.isMuted();
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.title = muted ? "Sound off" : "Sound on";
  }

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

  boardEl.addEventListener("click", onBoardClick);
  boardEl.addEventListener("keydown", onBoardKey);
  boardEl.addEventListener("animationend", onAnimationEnd);
  newGameBtn.addEventListener("click", onNewGameClick);
  muteBtn.addEventListener("click", () => {
    Sound.setMuted(!Sound.isMuted());
    showMuted();
  });
  playAgainBtn.addEventListener("click", () => {
    newGame();
    cells[focusIndex].button.focus();
  });

  buildBoard();
  showMuted();
  newGame();
})();
