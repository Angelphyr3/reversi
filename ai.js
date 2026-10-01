// The computer opponent. Pure functions only — like game.js it never touches the page — so it
// can be tested in Node. chooseMove() picks a move for whoever's turn it is in `state`.
//
//   easy    random legal move
//   medium  greedy (flips the most discs right now), but grabs corners and avoids giving them away
//   hard    position-weighted: prizes corners and edges, keeps its options open, and checks
//           the opponent's best reply before committing
//   expert  looks several moves ahead (minimax with alpha-beta pruning), and plays the last
//           stretch of the game perfectly
const ReversiAI = (() => {
  "use strict";

  const R = typeof Reversi !== "undefined" ? Reversi : require("./game.js");
  const { SIZE, opponent, getAllValidMoves, getFlipsForMove, applyMove } = R;

  const LEVELS = ["easy", "medium", "hard", "expert"];
  const HARD_DEPTH = 2; // its move plus the opponent's best reply
  const EXPERT_DEPTH = 4;
  // Expert looks one move deeper when the normal search was small enough that the deeper one
  // will still be quick. Counting positions (not time) keeps its play the same on every device.
  const EXPERT_DEEPEN_LIMIT = 4000;
  const ENDGAME_EMPTIES = 10; // with this few squares left, Expert searches to the very end
  const MOBILITY_WEIGHT = 5;
  const WIN_SCORE = 10000;

  // How valuable each square is. Corners can never be flipped back; the squares touching an
  // empty corner are dangerous because they let the opponent take it.
  const WEIGHTS = [
    [100, -20, 10, 5, 5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [10, -2, 5, 1, 1, 5, -2, 10],
    [5, -2, 1, 0, 0, 1, -2, 5],
    [5, -2, 1, 0, 0, 1, -2, 5],
    [10, -2, 5, 1, 1, 5, -2, 10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10, 5, 5, 10, -20, 100],
  ];

  const CORNERS = [
    { corner: [0, 0], near: [[0, 1], [1, 0], [1, 1]] },
    { corner: [0, 7], near: [[0, 6], [1, 7], [1, 6]] },
    { corner: [7, 0], near: [[6, 0], [7, 1], [6, 1]] },
    { corner: [7, 7], near: [[7, 6], [6, 7], [6, 6]] },
  ];

  // Once a corner is taken, the squares next to it are no longer dangerous.
  function weightsFor(board) {
    let weights = WEIGHTS;
    for (const { corner, near } of CORNERS) {
      if (board[corner[0]][corner[1]] !== null) {
        if (weights === WEIGHTS) weights = WEIGHTS.map((row) => row.slice());
        for (const [r, c] of near) weights[r][c] = 10;
      }
    }
    return weights;
  }

  function positional(board, me) {
    const weights = weightsFor(board);
    let score = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === me) score += weights[r][c];
        else if (board[r][c] !== null) score -= weights[r][c];
      }
    }
    return score;
  }

  function discDifference(board, me) {
    let diff = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell === me) diff++;
        else if (cell !== null) diff--;
      }
    }
    return diff;
  }

  function countEmpty(board) {
    let empty = 0;
    for (const row of board) for (const cell of row) if (cell === null) empty++;
    return empty;
  }

  // Finished game: a win always beats any unfinished position, and a bigger win beats a smaller one.
  function finalScore(board, me) {
    const diff = discDifference(board, me);
    return diff === 0 ? 0 : Math.sign(diff) * WIN_SCORE + diff;
  }

  // How good `board` is for `me`: square values plus having more moves available than the opponent.
  function evaluate(board, me) {
    const mine = getAllValidMoves(board, me).length;
    const theirs = getAllValidMoves(board, opponent(me)).length;
    if (mine === 0 && theirs === 0) return finalScore(board, me);
    return positional(board, me) + MOBILITY_WEIGHT * (mine - theirs);
  }

  // Trying the most promising squares first lets alpha-beta skip far more of the tree.
  function orderMoves(moves) {
    return moves.slice().sort((a, b) => WEIGHTS[b[0]][b[1]] - WEIGHTS[a[0]][a[1]]);
  }

  let positionsSearched = 0;

  function minimax(board, toMove, me, depth, alpha, beta, exact) {
    positionsSearched++;
    if (depth === 0) return exact ? finalScore(board, me) : evaluate(board, me);

    const moves = getAllValidMoves(board, toMove);
    if (moves.length === 0) {
      if (getAllValidMoves(board, opponent(toMove)).length === 0) return finalScore(board, me);
      return minimax(board, opponent(toMove), me, depth - 1, alpha, beta, exact); // forced pass
    }

    const maximizing = toMove === me;
    let best = maximizing ? -Infinity : Infinity;
    for (const [r, c] of orderMoves(moves)) {
      const score = minimax(applyMove(board, r, c, toMove), opponent(toMove), me, depth - 1, alpha, beta, exact);
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  // Picks randomly among the moves with the top score, so games don't repeat exactly.
  function bestOf(moves, scoreOf, random) {
    let best = -Infinity;
    let top = [];
    for (const move of moves) {
      const score = scoreOf(move);
      if (score > best) {
        best = score;
        top = [move];
      } else if (score === best) {
        top.push(move);
      }
    }
    return top[Math.floor(random() * top.length)];
  }

  const STRATEGIES = {
    easy(state, random) {
      return state.validMoves[Math.floor(random() * state.validMoves.length)];
    },

    // Pure "most flips" turns out barely better than random, so Medium is greedy with a little
    // common sense: it also values the square itself (corners good, squares by empty corners bad).
    medium(state, random) {
      const { board, currentPlayer: me } = state;
      const weights = weightsFor(board);
      return bestOf(
        state.validMoves,
        ([r, c]) => getFlipsForMove(board, r, c, me).length + weights[r][c],
        random
      );
    },

    hard(state, random) {
      return searchMove(state, HARD_DEPTH, false, random);
    },

    expert(state, random) {
      const empties = countEmpty(state.board);
      const exact = empties <= ENDGAME_EMPTIES;
      // Exact search runs to the end of the game: every empty square plus room for passes.
      if (exact) return searchMove(state, empties + 2, true, random);

      positionsSearched = 0;
      const move = searchMove(state, EXPERT_DEPTH, false, random);
      if (positionsSearched > EXPERT_DEEPEN_LIMIT) return move;
      return searchMove(state, EXPERT_DEPTH + 1, false, random);
    },
  };

  // Scores each legal move by looking `depth` moves ahead (counting this one) and picks the best.
  function searchMove(state, depth, exact, random) {
    const { board, currentPlayer: me } = state;
    return bestOf(
      orderMoves(state.validMoves),
      ([r, c]) =>
        minimax(applyMove(board, r, c, me), opponent(me), me, depth - 1, -Infinity, Infinity, exact),
      random
    );
  }

  // Returns [row, col] for the current player, or null if there's no move (or the game is over).
  function chooseMove(state, level, random = Math.random) {
    if (state.gameOver || state.validMoves.length === 0) return null;
    const strategy = STRATEGIES[level];
    if (!strategy) throw new Error(`Unknown level: ${level}`);
    return strategy(state, random);
  }

  return { LEVELS, chooseMove };
})();

if (typeof module !== "undefined") module.exports = ReversiAI;
