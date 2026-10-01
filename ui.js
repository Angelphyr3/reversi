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

  const cells = []; // index = row * SIZE + col
  let state;
  let focusIndex = 0; // the one board square reachable with Tab; arrows move it
  let toastTimer = null;
  let confirmTimer = null;

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

    if (state.passed) {
      showToast(`${NAMES[state.passed]} has no moves — ${NAMES[state.currentPlayer]} goes again!`);
    }
    if (state.gameOver) showBanner();
  }

  function play(index) {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const next = Reversi.playTurn(state, row, col);
    if (next === state) {
      if (!state.gameOver && state.board[row][col] === null) shake(cells[index].button);
      return;
    }
    state = next;
    render();
  }

  function shake(button) {
    button.classList.remove("nope");
    void button.offsetWidth; // restart the animation if it's already running
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
    bannerEl.hidden = true;
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
      newGameBtn.textContent = "Tap again to restart";
      confirmTimer = setTimeout(resetConfirm, CONFIRM_MS);
      return;
    }
    newGame();
  }

  function resetConfirm() {
    clearTimeout(confirmTimer);
    newGameBtn.classList.remove("confirming");
    newGameBtn.textContent = "New game";
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

  boardEl.addEventListener("click", onBoardClick);
  boardEl.addEventListener("keydown", onBoardKey);
  newGameBtn.addEventListener("click", onNewGameClick);
  playAgainBtn.addEventListener("click", () => {
    newGame();
    cells[focusIndex].button.focus();
  });

  buildBoard();
  newGame();
})();
