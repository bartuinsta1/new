// WebAudio ile üretilen müzik kutusu ve efektler: ses dosyası yok.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let delay: DelayNode | null = null;
let musicTimer: number | null = null;
let musicOn = true;
let sfxOn = true;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.22;
  delay = ctx.createDelay();
  delay.delayTime.value = 0.38;
  const fb = ctx.createGain();
  fb.gain.value = 0.35;
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(musicGain);
  musicGain.connect(master);
  return ctx;
}

/** İlk kullanıcı dokunuşunda çağrılmalı (mobil tarayıcı kuralı). */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
  if (musicOn && musicTimer === null) startMusic();
}

function note(freq: number, start: number, dur: number, vol: number, type: OscillatorType, dest: AudioNode) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(dest);
  o.start(start);
  o.stop(start + dur + 0.05);
}

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// Sıcak bir I–vi–IV–V döngüsü üzerinde pentatonik müzik kutusu
const CHORDS = [
  [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62],
];
const PENTA = [72, 74, 76, 79, 81, 84];

function startMusic() {
  if (!ctx || !musicGain || !delay) return;
  let bar = 0;
  const beat = 0.5;
  const schedule = () => {
    if (!ctx || !musicOn) return;
    const t0 = ctx.currentTime + 0.05;
    const chord = CHORDS[bar % CHORDS.length];
    note(midi(chord[0] - 12), t0, beat * 8, 0.12, 'sine', musicGain!);
    chord.forEach((m, i) => note(midi(m), t0 + i * beat * 0.5, beat * 4, 0.05, 'triangle', musicGain!));
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.45) {
        const m = PENTA[Math.floor(Math.random() * PENTA.length)];
        note(midi(m), t0 + i * beat, 1.6, 0.07, 'sine', delay!);
        note(midi(m + 12), t0 + i * beat, 0.6, 0.015, 'sine', delay!);
      }
    }
    bar++;
  };
  schedule();
  musicTimer = window.setInterval(schedule, 4000);
}

function stopMusic() {
  if (musicTimer !== null) window.clearInterval(musicTimer);
  musicTimer = null;
}

export function setMusic(on: boolean) {
  musicOn = on;
  if (!on) stopMusic();
  else if (ctx) startMusic();
}

export function setSfx(on: boolean) {
  sfxOn = on;
}

export type Sfx = 'tap' | 'clean' | 'buy' | 'place' | 'arrive' | 'leave' | 'level' | 'purr' | 'error';

export function sfx(kind: Sfx) {
  if (!sfxOn) return;
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  switch (kind) {
    case 'tap':
      note(midi(84), t, 0.12, 0.08, 'sine', master);
      break;
    case 'clean':
      [79, 84, 88].forEach((m, i) => note(midi(m), t + i * 0.05, 0.25, 0.08, 'triangle', master!));
      break;
    case 'buy':
      [72, 76, 79, 84].forEach((m, i) => note(midi(m), t + i * 0.07, 0.35, 0.09, 'triangle', master!));
      break;
    case 'place':
      note(midi(67), t, 0.2, 0.1, 'sine', master);
      note(midi(74), t + 0.08, 0.3, 0.1, 'sine', master);
      purr(t + 0.1, 0.9);
      break;
    case 'arrive':
      note(midi(88), t, 0.3, 0.06, 'sine', master);
      note(midi(84), t + 0.15, 0.4, 0.06, 'sine', master);
      break;
    case 'leave':
      [84, 79, 76].forEach((m, i) => note(midi(m), t + i * 0.1, 0.4, 0.06, 'sine', master!));
      break;
    case 'level':
      [72, 76, 79, 84, 88, 91].forEach((m, i) => note(midi(m), t + i * 0.09, 0.6, 0.09, 'triangle', master!));
      break;
    case 'purr':
      purr(t, 1.2);
      break;
    case 'error':
      note(midi(52), t, 0.18, 0.08, 'square', master);
      break;
  }
}

function purr(t: number, dur: number) {
  const c = ctx!;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.sin((Math.PI * i) / len);
    const am = 0.5 + 0.5 * Math.sin((2 * Math.PI * 24 * i) / c.sampleRate);
    d[i] = (Math.random() * 2 - 1) * env * am;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 220;
  const g = c.createGain();
  g.gain.value = 0.5;
  src.connect(lp);
  lp.connect(g);
  g.connect(master!);
  src.start(t);
}
