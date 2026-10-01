# Reversi — Project Plan

A browser-based version of the board game Reversi (Othello).

Status: **milestone 1 done** (game logic). Decisions get recorded here as we make them.

## The game (rules we're implementing)

- 8×8 board. Starts with 4 discs in the center: two white, two black, placed diagonally.
- Black moves first. Players alternate placing one disc of their color.
- A move is legal only if it "outflanks" at least one line of opponent discs — a straight line
  (horizontal, vertical, or diagonal) of opponent discs bounded on both ends by the new disc and
  another disc of the mover's color. All outflanked discs flip to the mover's color.
- If a player has no legal move, they pass. If neither player can move, the game ends.
- Winner is whoever has more discs at the end. Equal counts is a draw.

## Decisions

| Topic | Decision |
| --- | --- |
| Tech stack | Plain HTML/CSS/JS, no build step, no dependencies (same as doodle-pad) |
| Script loading | Classic `<script>` tags, not ES modules — see "Script loading" below |
| Testing | Node's built-in test runner (`node --test`), no packages to install |
| Game modes | Phase 1: two players on one device. Phase 2: computer opponent |
| Computer opponent difficulty | Selectable levels: Easy, Medium, Hard, Expert — see "Computer opponent" |
| Visual style | Classic green board, with a modern, playful finish — see "Look and feel" |
| Light / dark mode | Follows the device setting; every color has a light and a dark version |
| Screen sizes | Scales to fit any browser window, desktop or phone, portrait or landscape |
| Undo | **No** |
| Score display | "Player 1" (black) and "Player 2" (white) with live disc counts |
| Turn indicator | Yes — clearly shows whose turn it is |
| Legal-move hints | Yes (the architecture provides it for free) |
| Sounds | Yes — with a mute button |
| Flip animations | Yes |
| Hosting / sharing | Public GitHub repository, played via GitHub Pages — see "Security" |

## File structure

```
reversi/
├── index.html    # board container, score/turn display, controls
├── styles.css    # board grid, disc styling, highlight states
├── game.js       # core game logic — pure functions, no DOM
├── ui.js         # rendering + event handlers; calls into game.js
├── ai.js         # phase 2: computer opponent
└── tests/
    └── game.test.js
```

`game.js` must stay pure (no DOM references) so it can be unit-tested in Node and reused by the AI,
which needs to simulate moves without touching the screen.

### Script loading

ES modules (`<script type="module">`) do not load when `index.html` is opened by double-clicking
it — browsers block module imports from `file://` pages. To keep "just open index.html" working,
the files load as classic scripts in order (`game.js`, `ai.js`, `ui.js`) and share a single global
namespace object. `game.js` ends with a small guard that also exports its functions when running in
Node, so the tests can load it without a browser:

```js
if (typeof module !== "undefined") module.exports = Reversi;
```

## Core data structures

```
board = 8x8 array, each cell: null | 'black' | 'white'
DIRECTIONS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]

gameState = {
  board,
  currentPlayer: 'black' | 'white',
  blackCount, whiteCount,
  validMoves: [[row, col], ...],   // for the current player; the UI highlights these
  passed: null | 'black' | 'white', // set when the last turn ended in a forced pass
  gameOver: false,
  winner: null | 'black' | 'white' | 'draw'
}
```

Starting position (0-indexed): `[3][3]` white, `[3][4]` black, `[4][3]` black, `[4][4]` white
(D4 white, E4 black, D5 black, E5 white in board notation).

## Core algorithm

```
function getFlipsForMove(board, row, col, player):
    if board[row][col] is not empty: return []
    opponent = other(player)
    allFlips = []
    for each [dr, dc] in DIRECTIONS:
        lineFlips = []
        r, c = row + dr, col + dc
        while (r, c) on board AND board[r][c] == opponent:
            lineFlips.push([r, c]); r += dr; c += dc
        // a line counts only if it crossed ≥1 opponent disc AND ends on the player's own disc
        if (r, c) on board AND board[r][c] == player AND lineFlips.length > 0:
            allFlips.push(...lineFlips)
    return allFlips

isValidMove(board, row, col, player)  = getFlipsForMove(...).length > 0
getAllValidMoves(board, player)       = every [row, col] where isValidMove is true
applyMove(board, row, col, player)    = a NEW board with the disc placed and flips applied
```

### Turn loop

`playTurn(state, row, col)` returns a **new** state object; it never modifies the one passed in.
That lets the computer opponent try out moves safely without disturbing the real game.

```
function playTurn(state, row, col):
    if state.gameOver or not isValidMove(state.board, row, col, state.currentPlayer):
        return state                                  // ignore illegal click

    board = applyMove(state.board, row, col, state.currentPlayer)
    next = other(state.currentPlayer)
    passed = null

    if getAllValidMoves(board, next) is empty:
        if getAllValidMoves(board, state.currentPlayer) is empty:
            → game over: count discs, winner = more discs, or 'draw' if equal
        else:
            passed = next                             // next player must pass
            next = state.currentPlayer

    return new state with board, next player, counts, validMoves for next, passed, gameOver/winner
```

The logic never shows messages itself. It reports a pass through the `passed` field, and `ui.js`
decides how to tell the players (e.g. "White has no moves — Black plays again").

## Implementation notes

- Recompute valid moves after every turn and hand that list to the UI for highlighting. The UI
  never decides legality itself.
- Never mutate a board or state in place; always copy.
- Keep "no valid moves = pass" separate from "game over". The game ends only when **neither**
  player can move, not after one pass.

## Review notes on the original spec

Changes made to the spec drafted in chat, and why:

- **Project name kept as `reversi`.** "Othello" is a trademarked brand of the same game; Reversi is
  the generic name.
- **`playTurn` returns a new state** instead of modifying `gameState` in place. The original spec
  recommended copying boards but its turn loop mutated the state object, which would have quietly
  broken undo and the AI later.
- **`notifyPass` replaced by a `passed` field.** Showing a message is a UI job; putting it in
  `game.js` would break the "no DOM" rule.
- **Draws handled explicitly** (`winner: 'draw'`), and `validMoves` added to the state so the UI
  doesn't recompute it.
- **Classic scripts instead of modules**, so double-clicking `index.html` still works.

## Look and feel

- **Board:** classic felt green with soft rounded corners, gentle shadows and a slight depth, so it
  reads as a real game board but feels modern rather than old-fashioned.
- **Discs:** glossy black and white with a subtle highlight. Placing one gives a little "pop";
  captured discs flip with a 3D coin-flip animation, rippling outward from the placed disc.
- **Playful touches:** bouncy hover/tap feedback on legal squares, a cheerful game-over banner.
  Animations are skipped for people whose device is set to "reduce motion".
- **Light and dark mode:** all colors are defined once as named tokens with a light and a dark
  value, and the page switches automatically with the device setting. The green board stays green
  in both — the page background, panels and text around it change.
- **Scaling:** the board is always a square sized to the smaller of the window's width and height,
  with the score panel beside it on wide screens and above/below it on tall (phone) screens.
  Tapping works the same as clicking. No horizontal scrolling at any size.
- **Score:** "Player 1" (black) and "Player 2" (white), each with a disc count. The active player's
  panel is highlighted and there's a "Player 1's turn" label. Against the computer, Player 2 is
  labeled "Computer".
- **Sounds:** generated in code with the browser's Web Audio API — a soft click for placing a disc,
  a quick tick for each flip, and a short jingle at game end. No audio files to download or license.
  A mute button sits in the corner. (Browsers only allow sound after the first tap/click, which is
  fine since nothing plays before the first move.)

## Computer opponent

The player picks a difficulty before starting. All levels use the same pure functions from
`game.js` to explore moves.

| Level | Strategy |
| --- | --- |
| Easy | Random legal move |
| Medium | Greedy — the move that flips the most discs right now |
| Hard | Position-weighted — values corners and edges, avoids squares next to empty corners |
| Expert | Minimax look-ahead with alpha-beta pruning, using the position weights to score boards |

The computer waits a short moment before moving so its move is visible. Expert's search depth is
capped so it stays responsive on a phone.

## Security

The game is a static site: no server, no logins, no data collection, no third-party code. That
leaves very little to attack, and these rules keep it that way.

**Protecting people who play the game**

- **No outside code.** No CDNs, packages, analytics, fonts or embeds — every file the page loads
  comes from this repository.
- **Content Security Policy.** A `<meta>` tag in `index.html` tells the browser to run only scripts
  and styles from this site and to block all network requests, so even a mistake can't load or send
  anything elsewhere.
- **No `innerHTML` / `eval`.** The UI builds the page with DOM methods and `textContent`, which
  can't be tricked into running code.
- **Nothing personal stored.** At most, the mute and difficulty settings are saved in the browser.

**Protecting the repository**

- **No GitHub Actions.** GitHub Pages deploys straight from the `main` branch, so there are no
  workflows that could be abused through a pull request.
- **Branch protection on `main`:** no force-pushes or deletion. Strangers can suggest changes via
  pull request, but nothing merges without your approval.
- **Two-factor authentication** on your GitHub account (the single most important protection).
  ✅ Enabled (Oct 2026).
- **No secrets in the repo.** The game needs none. A `.gitignore` keeps out OS clutter and local
  Claude settings.

**Protecting your computer and privacy**

- **Commit email.** Every commit records an email address, and in a public repo anyone can read it.
  This repo uses your private GitHub "noreply" address instead of your work email. The one existing
  commit gets re-authored with it before the first push.
- **Nothing to install.** No npm packages means nothing downloaded to your machine can run code
  during an install. Tests use only Node's built-in runner.
- **Review before merging.** Code from someone else's pull request only reaches your computer if
  you pull it — read the changes (or ask Claude to review them) first.
- **Claude never pushes or publishes without asking you first.**

## Open questions

- None blocking. Exact colors and sounds will be tuned once there's something on screen to look at.

## Milestones

1. ✅ **Game logic** — `game.js` plus Node tests covering the starting position, flips in all
   8 directions, illegal moves, a forced pass, and game end/draw. Done: 16 tests, run with
   `node --test` from the `reversi` folder.
2. **Playable two-player game** — `index.html`, `styles.css`, `ui.js`: responsive board, light and
   dark colors, click/tap to move, legal-move highlights, Player 1/Player 2 scores, turn indicator,
   pass message, game-over banner, new-game button.
3. **Animations and sound** — disc pop and flip animations, Web Audio sounds, mute button,
   reduced-motion support.
4. **Computer opponent** — `ai.js` with the four difficulty levels, a mode/difficulty selector,
   and a short "thinking" delay.
5. **Publish** — security checklist, noreply commit email, create the GitHub repo, branch
   protection, enable GitHub Pages.
