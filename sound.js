// Sound effects, synthesized in code with the Web Audio API — no audio files to download or
// license. Browsers only allow sound after the player has clicked or tapped, which is always
// true by the time anything here plays. The mute setting is remembered in this browser.
const Sound = (() => {
  "use strict";

  const STORAGE_KEY = "reversi-muted";
  let ctx = null;
  let muted = loadMuted();

  function loadMuted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false; // storage blocked (private mode, strict settings) — just default to sound on
    }
  }

  function saveMuted() {
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // not remembered this time; harmless
    }
  }

  function audio() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // One short note: a waveform gliding from `from` to `to` Hz, with a quick attack and fade.
  // `start` is seconds from now, so a whole ripple of flips can be scheduled at once.
  function tone({ type = "sine", from, to = from, start = 0, length = 0.12, volume = 0.2 }) {
    if (muted) return;
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + start;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + length);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

  return {
    // A soft wooden "tok" as the disc lands.
    place() {
      tone({ type: "triangle", from: 440, to: 170, length: 0.14, volume: 0.35 });
      tone({ type: "sine", from: 1400, to: 700, length: 0.03, volume: 0.06 });
    },

    // A bright tick per flipped disc, each a little higher than the last.
    flip(order, delayMs) {
      const pitch = 700 + order * 45;
      tone({ from: pitch, to: pitch * 1.4, start: delayMs / 1000, length: 0.07, volume: 0.12 });
    },

    // A quiet low buzz for tapping a square that isn't a legal move.
    invalid() {
      tone({ type: "square", from: 150, to: 110, length: 0.1, volume: 0.04 });
    },

    // A two-note "uh-oh" when a player has to pass.
    pass(delayMs = 0) {
      const s = delayMs / 1000;
      tone({ type: "triangle", from: 520, start: s, length: 0.16, volume: 0.22 });
      tone({ type: "triangle", from: 390, start: s + 0.18, length: 0.24, volume: 0.22 });
    },

    // A rising arpeggio for a win, a level pair of notes for a draw.
    gameOver(isDraw, delayMs = 0) {
      const notes = isDraw ? [G5, G5] : [C5, E5, G5, C6];
      notes.forEach((freq, i) => {
        const last = i === notes.length - 1;
        tone({
          type: "triangle",
          from: freq,
          start: delayMs / 1000 + i * 0.13,
          length: last ? 0.5 : 0.18,
          volume: 0.25,
        });
      });
    },

    isMuted() {
      return muted;
    },

    setMuted(value) {
      muted = value;
      saveMuted();
      if (!muted) tone({ from: 880, to: 1320, length: 0.08, volume: 0.12 }); // "sound's on" blip
    },
  };
})();
