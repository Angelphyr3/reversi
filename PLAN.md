# Reversi — Project Plan

A browser-based version of the board game Reversi (Othello).

Status: **planning** — no code yet. Decisions get recorded here as we make them.

## The game (rules we're implementing)

- 8×8 board. Starts with 4 discs in the center: two white, two black, placed diagonally.
- Black moves first. Players alternate placing one disc of their color.
- A move is legal only if it "outflanks" at least one line of opponent discs — a straight line
  (horizontal, vertical, or diagonal) of opponent discs bounded on both ends by the new disc and
  another disc of the mover's color. All outflanked discs flip to the mover's color.
- If a player has no legal move, they pass. If neither player can move, the game ends.
- Winner is whoever has more discs at the end.

## Decisions

| Topic | Decision |
| --- | --- |
| Tech stack | _TBD_ |
| Game modes (2-player local / vs. computer) | _TBD_ |
| Computer opponent difficulty | _TBD_ |
| Visual style | _TBD_ |
| Extra features (move hints, undo, score, sounds…) | _TBD_ |
| Mobile / touch support | _TBD_ |
| Hosting / sharing | _TBD_ |

## Open questions

_(to be filled in as we plan)_

## Milestones

_(to be defined once the decisions above are made)_
