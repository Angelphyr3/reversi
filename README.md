# Reversi

The classic board game, playable in any web browser on desktop or phone.

**▶ Play it here: https://angelphyr3.github.io/reversi/**

## Features

- Play a friend on the same device, or the computer at four levels: Easy, Medium, Hard and Expert
- Legal-move hints (optional in two-player games)
- Coin-flip animations and sound effects, with a mute button
- Light and dark mode that follow your device setting
- A color-blind friendly board
- Keyboard play: arrow keys to move, Enter to place a disc

## Running it locally

There's nothing to install or build. Download the files and open `index.html` in a browser.

## Tests

The game rules and the computer opponent are covered by tests that use Node's built-in test
runner, with no packages needed:

```bash
node --test
```

## How it's built

Plain HTML, CSS and JavaScript, with no frameworks, libraries or outside services. The page
loads only its own files and never contacts any server.

| File | What it does |
| --- | --- |
| `game.js` | The rules of Reversi |
| `ai.js` | The computer opponent |
| `sound.js` | Sound effects, generated in code |
| `ui.js` | Draws the board and handles clicks, taps and keys |
| `PLAN.md` | Design decisions and the build plan |
