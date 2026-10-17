// Звук синтезируется WebAudio — без файлов. Музыка генеративная, в двух версиях:
// Отпечаток — тёплый пэд и медленные переборы; Шрам — обрезанные петли с пропусками.
// При смене фазы музыка не обрывается, а коротко «перескакивает».

const SCALES = {
  road: [146.8, 174.6, 196, 220, 261.6, 293.7],
  city: [130.8, 155.6, 174.6, 196, 233.1, 261.6],
  boss: [110, 130.8, 146.8, 155.6, 196, 220],
  hub: [174.6, 220, 261.6, 293.7, 349.2, 392],
  title: [123.5, 146.8, 164.8, 185, 220, 246.9],
};

export function createAudio() {
  let ac = null;
  let master;
  let sfxBus;
  let musicBus;
  let pastBus;
  let presentBus;
  let noiseBuf;
  const vol = { music: 0.6, sfx: 0.8 };
  const music = { track: null, phase: 'present', next: 0, step: 0, timer: null };

  function ensure() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.gain.value = vol.sfx;
    sfxBus.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = vol.music * 0.5;
    musicBus.connect(master);
    pastBus = ac.createGain();
    presentBus = ac.createGain();
    pastBus.connect(musicBus);
    presentBus.connect(musicBus);
    pastBus.gain.value = 0;
    presentBus.gain.value = 1;
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }

  function env(g, t, a, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }

  function tone(freq, { type = 'sine', a = 0.005, d = 0.2, peak = 0.3, bus = sfxBus, at = 0, glide = 0 } = {}) {
    if (!ensure()) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + a + d);
    env(g, t, a, peak, d);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  function noise({ d = 0.15, peak = 0.3, f = 1200, q = 1, type = 'bandpass', at = 0, sweep = 0, bus = sfxBus } = {}) {
    if (!ensure()) return;
    const t = ac.currentTime + at;
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + d);
    fl.Q.value = q;
    const g = ac.createGain();
    env(g, t, 0.004, peak, d);
    s.connect(fl).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + d + 0.05);
  }

  // Колокол: негармонические обертоны с разным затуханием.
  function bell(freq = 196, { dur = 4, peak = 0.35, bus, muffled = false } = {}) {
    if (!ensure()) return;
    const partials = [[0.5, 1], [1, 0.8], [1.19, 0.5], [1.5, 0.35], [2, 0.4], [2.74, 0.2], [3.0, 0.15], [4.07, 0.08]];
    for (const [r, amp] of partials) {
      if (muffled && r > 2) continue;
      tone(freq * r, { type: 'sine', a: 0.004, d: dur / (0.6 + r * 0.5), peak: peak * amp * 0.5, bus: bus || sfxBus });
    }
    noise({ d: 0.05, peak: peak * 0.3, f: freq * 6, q: 3 });
  }

  const sfx = {
    swing: (step) => noise({ d: 0.09, peak: 0.12, f: 1800 + step * 400, q: 0.8, sweep: 0.4 }),
    hit: (perfect) => {
      noise({ d: 0.07, peak: 0.35, f: 900, q: 1.2 });
      tone(perfect ? 520 : 180, { type: perfect ? 'triangle' : 'square', d: 0.08, peak: perfect ? 0.18 : 0.08, glide: 0.5 });
      if (perfect) tone(1040, { type: 'sine', d: 0.25, peak: 0.12, at: 0.02 });
    },
    flash: () => tone(1320, { type: 'sine', d: 0.06, peak: 0.05 }),
    dodge: () => noise({ d: 0.14, peak: 0.16, f: 600, q: 0.7, sweep: 3 }),
    // двойной металлический звук — идеальное уклонение
    perfectDodge: () => {
      tone(1480, { type: 'triangle', d: 0.18, peak: 0.16 });
      tone(1975, { type: 'triangle', d: 0.25, peak: 0.13, at: 0.07 });
    },
    // янтарный щелчок — сдвиг в прошлое; низкий треск — Шрам
    shift: (phase) => {
      if (phase === 'past') {
        tone(880, { type: 'triangle', d: 0.05, peak: 0.18 });
        tone(660, { type: 'sine', d: 0.5, peak: 0.12, at: 0.03, glide: 1.5 });
      } else {
        noise({ d: 0.22, peak: 0.25, f: 220, q: 2, type: 'lowpass' });
        tone(70, { type: 'sawtooth', d: 0.2, peak: 0.1, glide: 0.6 });
      }
    },
    channel: () => tone(330, { type: 'sine', a: 0.3, d: 0.3, peak: 0.06, glide: 2 }),
    cancel: () => tone(200, { type: 'square', d: 0.1, peak: 0.06, glide: 0.5 }),
    noCharge: () => tone(140, { type: 'square', d: 0.12, peak: 0.08 }),
    hurt: () => {
      noise({ d: 0.2, peak: 0.35, f: 400, q: 1 });
      tone(110, { type: 'sawtooth', d: 0.2, peak: 0.15, glide: 0.5 });
    },
    enemyDie: () => {
      for (let i = 0; i < 4; i++) noise({ d: 0.05, peak: 0.12, f: 2000 - i * 400, q: 4, at: i * 0.04 });
    },
    pickup: () => tone(990 + Math.random() * 200, { type: 'sine', d: 0.08, peak: 0.07 }),
    shard: () => {
      tone(1318, { type: 'triangle', d: 0.3, peak: 0.12 });
      tone(1760, { type: 'sine', d: 0.4, peak: 0.1, at: 0.08 });
    },
    chest: () => {
      noise({ d: 0.2, peak: 0.2, f: 300, q: 1 });
      [523, 659, 784].forEach((f, i) => tone(f, { type: 'triangle', d: 0.3, peak: 0.1, at: 0.1 + i * 0.08 }));
    },
    rift: () => {
      noise({ d: 0.6, peak: 0.35, f: 3000, q: 0.5, sweep: 0.1 });
      tone(55, { type: 'sine', d: 0.8, peak: 0.4, glide: 0.5 });
      bell(392, { dur: 1.5, peak: 0.2 });
    },
    note: () => tone(740 + Math.random() * 60, { type: 'triangle', d: 0.12, peak: 0.06 }),
    ring: () => bell(294, { dur: 1.2, peak: 0.18 }),
    charge: () => tone(220, { type: 'sawtooth', a: 0.6, d: 0.2, peak: 0.05, glide: 2 }),
    dash: () => noise({ d: 0.25, peak: 0.2, f: 300, q: 0.6, sweep: 4 }),
    fall: () => tone(400, { type: 'sine', d: 0.6, peak: 0.12, glide: 0.2 }),
    zap: () => {
      noise({ d: 0.12, peak: 0.18, f: 4000, q: 3 });
      tone(1200, { type: 'square', d: 0.06, peak: 0.04, glide: 0.3 });
    },
    ui: () => tone(660, { type: 'triangle', d: 0.05, peak: 0.06 }),
    uiOk: () => {
      tone(660, { type: 'triangle', d: 0.06, peak: 0.07 });
      tone(990, { type: 'triangle', d: 0.1, peak: 0.07, at: 0.05 });
    },
    text: () => tone(500 + Math.random() * 80, { type: 'square', d: 0.02, peak: 0.015 }),
    death: () => {
      bell(98, { dur: 5, peak: 0.3, muffled: true });
      noise({ d: 1.2, peak: 0.2, f: 1500, q: 0.6, sweep: 0.05 });
    },
    bell: (f = 196, muffled = false) => bell(f, { dur: 5, peak: 0.4, muffled }),
    heal: () => [392, 494, 587].forEach((f, i) => tone(f, { type: 'sine', d: 0.4, peak: 0.08, at: i * 0.07 })),
    burn: () => noise({ d: 0.1, peak: 0.08, f: 800, q: 0.5 }),
  };

  // ── генеративная музыка ───────────────────────────────────────────────
  function schedule() {
    if (!ac || !music.track) return;
    const scale = SCALES[music.track] || SCALES.road;
    const beat = music.track === 'boss' ? 0.32 : 0.48;
    while (music.next < ac.currentTime + 0.4) {
      const t = music.next - ac.currentTime;
      const s = music.step;
      // пэд раз в 8 долей
      if (s % 8 === 0) {
        const root = scale[(Math.floor(s / 16) % 2) * 2];
        for (const r of [0.5, 0.75, 1]) {
          tone(root * r, { type: 'triangle', a: 1.2, d: beat * 8, peak: 0.05, bus: pastBus, at: t });
          tone(root * r, { type: 'sawtooth', a: 0.02, d: beat * (1 + (s % 3)), peak: 0.02, bus: presentBus, at: t });
        }
      }
      // перебор Отпечатка
      if (s % 2 === 0) {
        const n = scale[(s * 3 + Math.floor(s / 8)) % scale.length];
        tone(n * 2, { type: 'triangle', d: beat * 2.5, peak: 0.035, bus: pastBus, at: t });
      }
      // Шрам: та же нота, но обрезанная и с пропусками
      const skip = (s * 7) % 5 === 0 || (s * 11) % 13 === 0;
      if (!skip) {
        const n = scale[(s * 5) % scale.length];
        tone(n * (s % 4 === 0 ? 1 : 2), { type: 'square', d: 0.05, peak: 0.018, bus: presentBus, at: t });
      }
      if (s % 4 === 0) noise({ d: 0.05, peak: music.track === 'boss' ? 0.06 : 0.025, f: 120, q: 1, type: 'lowpass', at: t, bus: presentBus });
      if (s % 32 === 0 && music.track !== 'hub') bell(scale[0], { dur: 4, peak: 0.08, bus: musicBus, muffled: true });
      music.next += beat;
      music.step++;
    }
  }

  function setMusic(track) {
    if (music.track === track) return;
    music.track = track;
    if (!ensure()) return;
    music.next = ac.currentTime + 0.1;
    music.step = 0;
    clearInterval(music.timer);
    if (track) music.timer = setInterval(schedule, 100);
  }

  function setMusicPhase(phase) {
    if (music.phase === phase) return;
    music.phase = phase;
    if (!ac) return;
    const t = ac.currentTime;
    // «перескок на соседний кадр»: короткий провал и смена слоя
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0.0001, t + 0.03);
    musicBus.gain.linearRampToValueAtTime(vol.music * 0.5, t + 0.12);
    pastBus.gain.setTargetAtTime(phase === 'past' ? 1 : 0.15, t + 0.03, 0.15);
    presentBus.gain.setTargetAtTime(phase === 'past' ? 0.1 : 1, t + 0.03, 0.15);
  }

  function setVolumes(music_, sfx_) {
    vol.music = music_;
    vol.sfx = sfx_;
    if (!ac) return;
    musicBus.gain.value = music_ * 0.5;
    sfxBus.gain.value = sfx_;
  }

  return {
    unlock() {
      if (!ensure()) return;
      if (ac.state === 'suspended') ac.resume();
      if (music.track && !music.timer) {
        const tr = music.track;
        music.track = null;
        setMusic(tr);
      }
    },
    sfx,
    setMusic,
    setMusicPhase,
    setVolumes,
    get ready() {
      return !!ac;
    },
  };
}
