"use client";

// A short two-note chime made by the browser itself (no sound file).
// Browsers only allow sound after the person has tapped the page once,
// so unlockAudio() is called on the first tap of the CK screens.

let ctx = null;

export function unlockAudio() {
  try {
    if (typeof window === "undefined") return;
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch {}
}

export function playChime() {
  try {
    unlockAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const start = t0 + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch {}
}
