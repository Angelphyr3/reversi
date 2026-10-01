// Tests for the computer opponent in ai.js. Run from the project folder with:  node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const Reversi = require("../game.js");
const ReversiAI = require("../ai.js");

const { BLACK, WHITE } = Reversi;

// Repeatable "random" numbers, so the games below play out the same way every run.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boardFrom(rows) {
  const board = Reversi.emptyBoard();
  rows.forEach((line, r) => {
    [...line.replace(/\s/g, "")].forEach((ch, c) => {
      if (ch === "B") board[r][c] = BLACK;
      if (ch === "W") board[r][c] = WHITE;
    });
  });
  return board;
}

const isListed = (state, move) => state.validMoves.some(([r, c]) => r === move[0] && c === move[1]);

// Plays one full game; returns the winner and the slowest single move in milliseconds.
function playGame(blackLevel, whiteLevel, random) {
  let state = Reversi.createGame();
  let slowest = 0;
  while (!state.gameOver) {
    const level = state.currentPlayer === BLACK ? blackLevel : whiteLevel;
    const start = performance.now();
    const [row, col] = ReversiAI.chooseMove(state, level, random);
    slowest = Math.max(slowest, performance.now() - start);
    state = Reversi.playTurn(state, row, col);
  }
  return { winner: state.winner, slowest };
}

function record(blackLevel, whiteLevel, games, seed) {
  const random = seeded(seed);
  const result = { blackWins: 0, whiteWins: 0, draws: 0, slowest: 0 };
  for (let i = 0; i < games; i++) {
    const { winner, slowest } = playGame(blackLevel, whiteLevel, random);
    if (winner === BLACK) result.blackWins++;
    else if (winner === WHITE) result.whiteWins++;
    else result.draws++;
    result.slowest = Math.max(result.slowest, slowest);
  }
  return result;
}

test("every level always picks a legal move, all game long", () => {
  const random = seeded(1);
  for (const level of ReversiAI.LEVELS) {
    let state = Reversi.createGame();
    while (!state.gameOver) {
      const move = ReversiAI.chooseMove(state, level, random);
      assert.ok(isListed(state, move), `${level} chose an illegal move`);
      state = Reversi.playTurn(state, ...move);
    }
  }
});

test("no move is returned once the game is over", () => {
  const over = Reversi.playTurn(Reversi.createGame(boardFrom(["B W"]), BLACK), 0, 2);
  for (const level of ReversiAI.LEVELS) assert.equal(ReversiAI.chooseMove(over, level), null);
});

test("an unknown level is an error, not a silent random move", () => {
  assert.throws(() => ReversiAI.chooseMove(Reversi.createGame(), "impossible"));
});

test("medium takes the move that flips the most discs", () => {
  // Black at (3,0) flips 1 disc; black at (5,7) flips 4.
  const board = boardFrom([
    "",
    "",
    "",
    ". W B",
    "",
    ". . B W W W W .",
  ]);
  const state = Reversi.createGame(board, BLACK);
  assert.deepEqual(ReversiAI.chooseMove(state, "medium", seeded(2)), [5, 7]);
});

test("hard and expert grab an available corner", () => {
  // Black can take corner (7,7), or flip more discs with a move along the top.
  const board = boardFrom([
    "",
    ". . W W W B",
    ". . W B",
    ". . B W B",
    ". . . B W",
    ". . . . . B",
    ". . . . . . W",
  ]);
  const state = Reversi.createGame(board, BLACK);
  for (const level of ["hard", "expert"]) {
    assert.deepEqual(ReversiAI.chooseMove(state, level, seeded(3)), [7, 7], level);
  }
});

test("hard avoids the square that hands over a corner", () => {
  // (1,1) next to the empty (0,0) corner, versus a harmless square near the middle.
  const board = boardFrom([
    "",
    "",
    ". . W . . W",
    ". . . B B B",
    ". . . . . .",
  ]);
  const state = Reversi.createGame(board, WHITE);
  const options = state.validMoves.map(String);
  assert.ok(options.includes("1,1") || options.length > 1);
  const move = ReversiAI.chooseMove(state, "hard", seeded(4));
  assert.notDeepEqual(move, [1, 1]);
});

test("expert plays the endgame perfectly: it finds the only winning move", () => {
  // Black to move with 5 empty squares. Only one choice wins; exact search must find it.
  const board = boardFrom([
    "W W W W W W W W",
    "W W W W W W W W",
    "B B B B B B W W",
    "B B B B B B B W",
    "B B B B B B B B",
    "B B B W W B B .",
    "B B B B W W . .",
    "B B B B B . . .",
  ]);
  const state = Reversi.createGame(board, BLACK);
  const move = ReversiAI.chooseMove(state, "expert", seeded(5));
  // Check the claim by brute force: every alternative must do worse against best play.
  const outcome = (s) => {
    if (s.gameOver) return s.blackCount - s.whiteCount;
    const results = s.validMoves.map(([r, c]) => outcome(Reversi.playTurn(s, r, c)));
    return s.currentPlayer === BLACK ? Math.max(...results) : Math.min(...results);
  };
  const best = Math.max(...state.validMoves.map(([r, c]) => outcome(Reversi.playTurn(state, r, c))));
  assert.equal(outcome(Reversi.playTurn(state, ...move)), best);
});

test("each level beats the one below it most of the time", () => {
  const ladder = [
    ["medium", "easy"],
    ["hard", "medium"],
    ["expert", "hard"],
  ];
  for (const [strong, weak] of ladder) {
    // Play both colors so moving first isn't an advantage either way.
    const a = record(strong, weak, 6, 10);
    const b = record(weak, strong, 6, 20);
    const strongWins = a.blackWins + b.whiteWins;
    assert.ok(strongWins >= 9, `${strong} won only ${strongWins}/12 against ${weak}`);
  }
});

test("expert never loses to easy and stays fast enough for a phone", () => {
  const a = record("expert", "easy", 4, 30);
  const b = record("easy", "expert", 4, 40);
  assert.equal(a.whiteWins + b.blackWins, 0, "expert lost a game to easy");
  const slowest = Math.max(a.slowest, b.slowest);
  // A desktop is several times faster than a phone, so keep a wide margin.
  assert.ok(slowest < 400, `slowest expert move took ${Math.round(slowest)} ms`);
});
