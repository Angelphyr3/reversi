// Reversi game rules. Pure functions only — no DOM — so the same code runs in the browser,
// in Node tests, and inside the computer opponent's look-ahead. Nothing here ever modifies a
// board or state passed in; every change returns a new copy.
const Reversi = (() => {
  "use strict";

  const SIZE = 8;
  const BLACK = "black";
  const WHITE = "white";
  const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  function opponent(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function onBoard(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function emptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  function cloneBoard(board) {
    return board.map((row) => row.slice());
  }

  // Standard opening: D4 white, E4 black, D5 black, E5 white.
  function createBoard() {
    const board = emptyBoard();
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    return board;
  }

  // Every opponent disc that placing `player` at (row, col) would flip. Empty means illegal.
  function getFlipsForMove(board, row, col, player) {
    if (!onBoard(row, col) || board[row][col] !== null) return [];

    const enemy = opponent(player);
    const flips = [];

    for (const [dr, dc] of DIRECTIONS) {
      const line = [];
      let r = row + dr;
      let c = col + dc;
      while (onBoard(r, c) && board[r][c] === enemy) {
        line.push([r, c]);
        r += dr;
        c += dc;
      }
      // A line only counts if it crossed at least one enemy disc and ends on the player's own.
      if (line.length > 0 && onBoard(r, c) && board[r][c] === player) {
        flips.push(...line);
      }
    }
    return flips;
  }

  function isValidMove(board, row, col, player) {
    return getFlipsForMove(board, row, col, player).length > 0;
  }

  function getAllValidMoves(board, player) {
    const moves = [];
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (isValidMove(board, row, col, player)) moves.push([row, col]);
      }
    }
    return moves;
  }

  function applyMove(board, row, col, player) {
    const flips = getFlipsForMove(board, row, col, player);
    if (flips.length === 0) {
      throw new Error(`Illegal move for ${player} at row ${row}, col ${col}`);
    }
    const next = cloneBoard(board);
    next[row][col] = player;
    for (const [r, c] of flips) next[r][c] = player;
    return next;
  }

  function countDiscs(board) {
    let black = 0;
    let white = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell === BLACK) black++;
        else if (cell === WHITE) white++;
      }
    }
    return { black, white };
  }

  // Builds a full state for `board` with `player` due to move, resolving forced passes and
  // game end. The game ends only when neither player has a legal move.
  function buildState(board, player) {
    let currentPlayer = player;
    let passed = null;
    let validMoves = getAllValidMoves(board, currentPlayer);

    if (validMoves.length === 0) {
      const other = opponent(currentPlayer);
      const otherMoves = getAllValidMoves(board, other);
      if (otherMoves.length > 0) {
        passed = currentPlayer;
        currentPlayer = other;
        validMoves = otherMoves;
      }
    }

    const { black, white } = countDiscs(board);
    const gameOver = validMoves.length === 0;
    let winner = null;
    if (gameOver) {
      winner = black > white ? BLACK : white > black ? WHITE : "draw";
    }

    return {
      board,
      currentPlayer,
      blackCount: black,
      whiteCount: white,
      validMoves,
      passed,
      gameOver,
      winner,
    };
  }

  // A new game from the standard opening, or from any board (used by tests and the AI).
  function createGame(board = createBoard(), player = BLACK) {
    return buildState(cloneBoard(board), player);
  }

  // Returns the state after the current player moves at (row, col). Illegal moves, and any
  // move once the game is over, return the same state unchanged.
  function playTurn(state, row, col) {
    if (state.gameOver || !isValidMove(state.board, row, col, state.currentPlayer)) {
      return state;
    }
    const board = applyMove(state.board, row, col, state.currentPlayer);
    return buildState(board, opponent(state.currentPlayer));
  }

  return {
    SIZE,
    BLACK,
    WHITE,
    DIRECTIONS,
    opponent,
    emptyBoard,
    createBoard,
    getFlipsForMove,
    isValidMove,
    getAllValidMoves,
    applyMove,
    countDiscs,
    createGame,
    playTurn,
  };
})();

if (typeof module !== "undefined") module.exports = Reversi;
