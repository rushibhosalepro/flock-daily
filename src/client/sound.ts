/**
 * Small game sounds, made with Web Audio at play time, so there are no files to
 * load and no external requests. Everything is quiet and short on purpose:
 * Flock plays inside a feed, often next to other tabs.
 *
 * Browsers only allow audio after a tap or key press, so the AudioContext is
 * created on the first sound, which always follows player input.
 */

let ctx: AudioContext | null = null;
let muted = false;
let noise: AudioBuffer | null = null;

const MASTER = 0.18;

const audio = (): AudioContext | null => {
  if (muted) return null;
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

export const setMuted = (value: boolean): void => {
  muted = value;
};

export const isMuted = (): boolean => muted;

/** One second of white noise, reused for the wing and thud sounds. */
const noiseBuffer = (ac: AudioContext): AudioBuffer => {
  if (noise) return noise;
  const buffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buffer;
  return buffer;
};

type Tone = {
  freq: number;
  /** Frequency to glide to by the end, if any. */
  to?: number;
  start: number;
  length: number;
  type: OscillatorType;
  volume: number;
};

const tone = (ac: AudioContext, t: Tone): void => {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const at = ac.currentTime + t.start;
  osc.type = t.type;
  osc.frequency.setValueAtTime(t.freq, at);
  if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, at + t.length);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(t.volume * MASTER, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + t.length);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + t.length + 0.02);
};

const hiss = (
  ac: AudioContext,
  { freq, length, volume }: { freq: number; length: number; volume: number }
): void => {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const gain = ac.createGain();
  const at = ac.currentTime;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume * MASTER, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(at, Math.random() * 0.5);
  src.stop(at + length + 0.02);
};

/** A soft wing flap: the flock takes off. */
export const playFlap = (): void => {
  const ac = audio();
  if (!ac) return;
  hiss(ac, { freq: 1400, length: 0.09, volume: 0.9 });
  tone(ac, { freq: 520, to: 360, start: 0, length: 0.07, type: 'sine', volume: 0.25 });
};

/** A dull bump: a bird hit a hedge, the edge or another bird. Louder when nobody moved. */
export const playThud = (allBlocked: boolean): void => {
  const ac = audio();
  if (!ac) return;
  const volume = allBlocked ? 1 : 0.55;
  tone(ac, { freq: 150, to: 70, start: 0, length: 0.13, type: 'sine', volume });
  hiss(ac, { freq: 300, length: 0.06, volume: volume * 0.5 });
};

/** NEST_NOTES rise as more birds are home, so the third landing sounds like an arrival. */
const NEST_NOTES = [1047, 1319, 1568];

/** A two-note chirp: a bird reached its nest. `home` is how many are home now (1 to 3). */
export const playLand = (home: number): void => {
  const ac = audio();
  if (!ac) return;
  const base = NEST_NOTES[Math.min(Math.max(home, 1), 3) - 1] ?? 1047;
  tone(ac, { freq: base * 0.84, to: base, start: 0.03, length: 0.08, type: 'triangle', volume: 0.5 });
  tone(ac, { freq: base * 1.12, to: base * 1.26, start: 0.11, length: 0.09, type: 'triangle', volume: 0.45 });
};

/** A quick sparkle: the golden feather is collected. */
export const playFeather = (): void => {
  const ac = audio();
  if (!ac) return;
  [1568, 2093, 2637, 3136].forEach((freq, i) =>
    tone(ac, { freq, start: i * 0.05, length: 0.16, type: 'sine', volume: 0.32 })
  );
};

/** A short tune for a solve. Perfect and Crown solves get a fuller ending. */
export const playWin = (big: boolean): void => {
  const ac = audio();
  if (!ac) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) =>
    tone(ac, { freq, start: 0.15 + i * 0.1, length: 0.18, type: 'triangle', volume: 0.5 })
  );
  if (big) {
    [1047, 1319, 1568].forEach((freq) =>
      tone(ac, { freq, start: 0.6, length: 0.55, type: 'sine', volume: 0.3 })
    );
  }
};
