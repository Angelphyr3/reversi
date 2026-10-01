// Tests for the game rules in game.js. Run from the project folder with:  node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const Reversi = require("../game.js");

const { BLACK, WHITE } = Reversi;

// Builds a board from rows of text: "B" black, "W" white, "." empty. Missing rows/cells are empty.
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

const sortMoves = (moves) => [...moves].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

test("new game starts with the standard four-disc opening, black to move", () => {
  const state = Reversi.createGame();
  assert.equal(state.board[3][3], WHITE);
  assert.equal(state.board[3][4], BLACK);
  assert.equal(state.board[4][3], BLACK);
  assert.equal(state.board[4][4], WHITE);
  assert.equal(state.blackCount, 2);
  assert.equal(state.whiteCount, 2);
  assert.equal(state.currentPlayer, BLACK);
  assert.equal(state.passed, null);
  assert.equal(state.gameOver, false);
  assert.equal(state.winner, null);
});

test("black has exactly four legal opening moves", () => {
  const state = Reversi.createGame();
  assert.deepEqual(sortMoves(state.validMoves), [[2, 3], [3, 2], [4, 5], [5, 4]]);
});

test("flips are found in each of the 8 directions on their own", () => {
  for (const [dr, dc] of Reversi.DIRECTIONS) {
    const board = Reversi.emptyBoard();
    board[3 + dr][3 + dc] = WHITE;
    board[3 + 2 * dr][3 + 2 * dc] = BLACK;
    assert.deepEqual(
      Reversi.getFlipsForMove(board, 3, 3, BLACK),
      [[3 + dr, 3 + dc]],
      `direction [${dr}, ${dc}]`
    );
  }
});

test("one move can flip in all 8 directions at once", () => {
  const board = boardFrom([
    "",
    ". B . B . B",
    ". . W W W",
    ". B W . W B",
    ". . W W W",
    ". B . B . B",
  ]);
  const after = Reversi.applyMove(board, 3, 3, BLACK);
  assert.deepEqual(Reversi.countDiscs(after), { black: 17, white: 0 });
});

test("a long line of opponent discs flips completely", () => {
  const board = boardFrom(["", "", "", ". W W W W W W B"]);
  const flips = Reversi.getFlipsForMove(board, 3, 0, BLACK);
  assert.equal(flips.length, 6);
});

test("a line that runs off the edge or hits a gap does not flip", () => {
  const offEdge = boardFrom(["", "", "", ". W W W W W W W"]);
  assert.deepEqual(Reversi.getFlipsForMove(offEdge, 3, 0, BLACK), []);

  const gap = boardFrom(["", "", "", ". W W . B"]);
  assert.deepEqual(Reversi.getFlipsForMove(gap, 3, 0, BLACK), []);
});

test("illegal moves: occupied square, no outflank, next to own disc only, off the board", () => {
  const board = Reversi.createBoard();
  assert.equal(Reversi.isValidMove(board, 3, 3, BLACK), false); // occupied
  assert.equal(Reversi.isValidMove(board, 0, 0, BLACK), false); // nothing nearby
  assert.equal(Reversi.isValidMove(board, 5, 3, BLACK), false); // touches only black
  assert.equal(Reversi.isValidMove(board, -1, 3, BLACK), false);
  assert.equal(Reversi.isValidMove(board, 3, 8, BLACK), false);
  assert.throws(() => Reversi.applyMove(board, 0, 0, BLACK));
});

test("playing a move flips discs, updates counts and passes the turn", () => {
  const state = Reversi.playTurn(Reversi.createGame(), 2, 3);
  assert.equal(state.board[2][3], BLACK);
  assert.equal(state.board[3][3], BLACK);
  assert.equal(state.blackCount, 4);
  assert.equal(state.whiteCount, 1);
  assert.equal(state.currentPlayer, WHITE);
  assert.deepEqual(sortMoves(state.validMoves), [[2, 2], [2, 4], [4, 2]]);
});

test("an illegal click returns the same state untouched", () => {
  const state = Reversi.createGame();
  assert.equal(Reversi.playTurn(state, 0, 0), state);
});

test("moves never modify the board or state passed in", () => {
  const state = Reversi.createGame();
  const before = JSON.stringify(state);
  const next = Reversi.playTurn(state, 2, 3);
  assert.equal(JSON.stringify(state), before);
  assert.notEqual(next.board, state.board);
});

test("a player with no legal moves passes, and the other player goes again", () => {
  // After black takes (0,2), white's only discs can't reach anything — but black can still
  // capture the bottom row, so white must pass rather than the game ending.
  const board = boardFrom(["B W", "", "", "", "", "", "", "B W W"]);
  const after = Reversi.playTurn(Reversi.createGame(board, BLACK), 0, 2);
  assert.equal(after.passed, WHITE);
  assert.equal(after.currentPlayer, BLACK);
  assert.equal(after.gameOver, false);
  assert.deepEqual(after.validMoves, [[7, 3]]);
});

test("the pass flag clears on the next normal turn", () => {
  const board = boardFrom(["B W", "", "", "", "", "", "", "B W W"]);
  let state = Reversi.playTurn(Reversi.createGame(board, BLACK), 0, 2);
  state = Reversi.playTurn(state, 7, 3);
  assert.equal(state.passed, null);
});

test("the game ends when neither player can move, even with empty squares left", () => {
  const board = boardFrom(["B W"]);
  const after = Reversi.playTurn(Reversi.createGame(board, BLACK), 0, 2);
  assert.equal(after.gameOver, true);
  assert.equal(after.winner, BLACK);
  assert.deepEqual(after.validMoves, []);
  assert.equal(Reversi.playTurn(after, 1, 1), after); // no moves accepted after the end
});

test("equal disc counts at the end is a draw", () => {
  const board = boardFrom(["B W", "", "", "", "", "", "", ". . . . . W W W"]);
  const after = Reversi.playTurn(Reversi.createGame(board, BLACK), 0, 2);
  assert.equal(after.gameOver, true);
  assert.equal(after.blackCount, 3);
  assert.equal(after.whiteCount, 3);
  assert.equal(after.winner, "draw");
});

test("white wins when white has more discs", () => {
  const board = boardFrom(["W B"]);
  const after = Reversi.playTurn(Reversi.createGame(board, WHITE), 0, 2);
  assert.equal(after.gameOver, true);
  assert.equal(after.winner, WHITE);
});

test("a full game of random legal moves always follows the rules and ends", () => {
  for (let game = 0; game < 50; game++) {
    let state = Reversi.createGame();
    let turns = 0;
    while (!state.gameOver) {
      const [row, col] = state.validMoves[Math.floor(Math.random() * state.validMoves.length)];
      const next = Reversi.playTurn(state, row, col);
      assert.notEqual(next, state, "a listed valid move must be accepted");
      assert.equal(next.blackCount + next.whiteCount, state.blackCount + state.whiteCount + 1);
      state = next;
      assert.ok(++turns <= 60, "a game can't last more than 60 moves");
    }
    assert.ok(["black", "white", "draw"].includes(state.winner));
  }
});
