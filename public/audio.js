/* Synthesised retro audio — no sound files needed. */
window.Audio8 = (() => {
  let ctx = null, sfxGain = null, musicGain = null, master = null;
  const cfg = { sfx: true, sfxVol: 0.6, music: false, musicVol: 0.35 };
  let musicTimer = null, step = 0, nextTime = 0, ringTimer = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.connect(master);
    apply();
    return true;
  }

  function apply() {
    if (!ctx) return;
    sfxGain.gain.setTargetAtTime(cfg.sfx ? cfg.sfxVol : 0, ctx.currentTime, 0.02);
    musicGain.gain.setTargetAtTime(cfg.music ? cfg.musicVol * 0.5 : 0, ctx.currentTime, 0.1);
    if (cfg.music) startMusic(); else stopMusic();
  }

  function tone(freq, dur, { type = 'square', vol = 0.25, at = 0, slide = 0, out = sfxGain } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, { vol = 0.2, at = 0, from = 400, to = 4000 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t);
  }

  const SFX = {
    click: () => tone(1200, 0.04, { vol: 0.12 }),
    open: () => { tone(520, 0.06, { vol: 0.15 }); tone(780, 0.08, { vol: 0.15, at: 0.05 }); },
    close: () => { tone(700, 0.05, { vol: 0.12 }); tone(420, 0.08, { vol: 0.12, at: 0.04 }); },
    msg: () => tone(980, 0.07, { type: 'triangle', vol: 0.18 }),
    success: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, { type: 'square', vol: 0.16, at: i * 0.07 })),
    fail: () => { tone(220, 0.25, { type: 'sawtooth', vol: 0.18 }); tone(160, 0.35, { type: 'sawtooth', vol: 0.18, at: 0.18 }); },
    coin: () => { tone(988, 0.08, { vol: 0.18 }); tone(1319, 0.3, { vol: 0.18, at: 0.08 }); },
    jackpot: () => [523, 659, 784, 1046, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.18, { type: 'square', vol: 0.14, at: i * 0.08 })),
    boot: () => { tone(110, 0.6, { type: 'sawtooth', vol: 0.12, slide: 400 }); noise(0.4, { vol: 0.08, at: 0.1 }); },
    error: () => tone(180, 0.15, { type: 'square', vol: 0.15 }),
    mystery: () => [392, 370, 349, 330].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.15, at: i * 0.3 })),
    launch: () => { noise(3.2, { vol: 0.35, from: 150, to: 3000 }); tone(80, 3, { type: 'sawtooth', vol: 0.12, slide: 900 }); },
    type: () => tone(1800 + Math.random() * 600, 0.015, { vol: 0.04 })
  };

  function play(name) { if (!cfg.sfx || !ensure()) return; (SFX[name] || SFX.click)(); }

  function ring(on) {
    clearInterval(ringTimer); ringTimer = null;
    if (!on) return;
    const burst = () => { if (!cfg.sfx || !ensure()) return; for (let i = 0; i < 8; i++) { tone(i % 2 ? 1300 : 1050, 0.05, { vol: 0.12, at: i * 0.06 }); } };
    burst(); ringTimer = setInterval(burst, 1500);
  }

  // ── Tiny synthwave loop ──
  const BASS = [45, 45, 52, 52, 48, 48, 43, 43]; // MIDI
  const ARP = [0, 7, 12, 15, 12, 7, 3, 7];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function startMusic() {
    if (musicTimer || !ctx) return;
    nextTime = ctx.currentTime + 0.1; step = 0;
    musicTimer = setInterval(() => {
      while (nextTime < ctx.currentTime + 0.3) {
        const bar = Math.floor(step / 8) % BASS.length; const root = BASS[bar];
        const at = nextTime - ctx.currentTime;
        if (step % 2 === 0) tone(mtof(root - 12), 0.22, { type: 'triangle', vol: 0.35, at, out: musicGain });
        tone(mtof(root + 12 + ARP[step % 8]), 0.12, { type: 'square', vol: 0.06, at, out: musicGain });
        if (step % 4 === 2) tone(mtof(root + 24 + ARP[(step + 3) % 8]), 0.3, { type: 'sine', vol: 0.05, at, out: musicGain });
        nextTime += 0.16; step++;
      }
    }, 80);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

  function set(next) { Object.assign(cfg, next); if (ensure()) apply(); }

  return { play, ring, set, cfg, unlock: () => { if (ensure()) apply(); } };
})();
