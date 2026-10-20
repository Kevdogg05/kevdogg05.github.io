/**
 * Brain Gate Quest — sound effects and music.
 *
 * Everything is synthesised live with the Web Audio API (square, triangle
 * and noise "chiptune" voices), so there are no audio files to load.
 * Browsers only allow audio after a user gesture, so `unlock()` is called
 * from the Play button.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;

  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let noiseBuffer = null;
  let muted = BGQ.storage.get('muted', false);

  // Music sequencer state
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;

  const MUSIC_VOLUME = 0.55;
  const STEP_SECONDS = 0.19; // one eighth note

  /** MIDI note number to frequency in Hz. */
  function hz(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function ensureContext() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch (err) {
      ctx = null;
      return false;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_VOLUME;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);

    // One second of white noise for crunchy effects (brick breaking, fireworks).
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  /**
   * Plays one synthesised note.
   * @param {object} o - { type, freq, toFreq, start, dur, vol, bus }
   */
  function tone(o) {
    if (!ctx) return;
    const t0 = o.start !== undefined ? o.start : ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.toFreq) osc.frequency.exponentialRampToValueAtTime(o.toFreq, t0 + o.dur);
    const vol = o.vol !== undefined ? o.vol : 0.12;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(gain);
    gain.connect(o.bus || sfxBus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  function noise(dur, vol, start) {
    if (!ctx) return;
    const t0 = start !== undefined ? start : ctx.currentTime;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    src.buffer = noiseBuffer;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Plays a quick sequence of notes: [[midi, durationSeconds], ...]. */
  function arpeggio(notes, type, vol) {
    let t = ctx.currentTime;
    notes.forEach(function (n) {
      tone({ type: type, freq: hz(n[0]), start: t, dur: n[1] * 1.4, vol: vol });
      t += n[1];
    });
  }

  /** The library of sound effects, keyed by name. */
  const SFX = {
    jump: function () { tone({ freq: 280, toFreq: 720, dur: 0.16, vol: 0.09 }); },
    coin: function () {
      const t = ctx.currentTime;
      tone({ freq: hz(83), start: t, dur: 0.07, vol: 0.09 });
      tone({ freq: hz(88), start: t + 0.07, dur: 0.28, vol: 0.09 });
    },
    stomp: function () { tone({ freq: 520, toFreq: 90, dur: 0.14, vol: 0.13 }); },
    bump: function () { tone({ type: 'triangle', freq: 160, toFreq: 80, dur: 0.1, vol: 0.25 }); },
    brick: function () {
      noise(0.22, 0.35);
      tone({ type: 'triangle', freq: 220, toFreq: 60, dur: 0.18, vol: 0.2 });
    },
    item: function () { arpeggio([[60, 0.05], [67, 0.05], [72, 0.05], [79, 0.08]], 'square', 0.07); },
    oneUp: function () { arpeggio([[76, 0.08], [79, 0.08], [88, 0.08], [84, 0.08], [86, 0.08], [91, 0.14]], 'square', 0.08); },
    die: function () {
      arpeggio([[72, 0.12], [71, 0.12], [70, 0.12], [64, 0.14], [60, 0.3]], 'square', 0.1);
    },
    gateAppear: function () { arpeggio([[67, 0.08], [72, 0.08], [76, 0.12]], 'triangle', 0.22); },
    correct: function () { arpeggio([[72, 0.08], [76, 0.08], [79, 0.08], [84, 0.22]], 'square', 0.1); },
    wrong: function () {
      const t = ctx.currentTime;
      tone({ type: 'triangle', freq: hz(64), start: t, dur: 0.18, vol: 0.22 });
      tone({ type: 'triangle', freq: hz(60), start: t + 0.16, dur: 0.3, vol: 0.22 });
    },
    gateOpen: function () {
      tone({ type: 'triangle', freq: 110, toFreq: 440, dur: 0.9, vol: 0.25 });
      arpeggio([[72, 0.1], [79, 0.1], [84, 0.1], [88, 0.1], [91, 0.3]], 'square', 0.06);
    },
    flag: function () { tone({ freq: 900, toFreq: 200, dur: 1.0, vol: 0.07 }); },
    firework: function () {
      noise(0.5, 0.25);
      tone({ type: 'triangle', freq: 90, toFreq: 40, dur: 0.4, vol: 0.3 });
    },
    victory: function () {
      arpeggio([
        [67, 0.14], [72, 0.14], [76, 0.14], [79, 0.14], [84, 0.14], [88, 0.14], [91, 0.42],
        [88, 0.14], [91, 0.6]
      ], 'square', 0.09);
    },
    spring: function () {
      tone({ type: 'square', freq: 180, toFreq: 900, dur: 0.22, vol: 0.08 });
      tone({ type: 'triangle', freq: 90, toFreq: 300, dur: 0.18, vol: 0.2 });
    },
    sizzle: function () {
      noise(0.6, 0.3);
      tone({ type: 'square', freq: 400, toFreq: 120, dur: 0.4, vol: 0.06 });
    },
    levelUp: function () { arpeggio([[72, 0.07], [76, 0.07], [79, 0.07], [84, 0.07], [88, 0.2]], 'triangle', 0.25); },
    click: function () { tone({ freq: 660, dur: 0.05, vol: 0.06 }); },
    pause: function () { arpeggio([[79, 0.06], [76, 0.06], [79, 0.06], [76, 0.08]], 'square', 0.06); }
  };

  /* ------------------------------------------------------------------ *
   * Background music: an original, cheerful 4-bar loop.
   * Lead melody in eighth notes (MIDI numbers, -1 = rest) and a
   * bass line in quarter notes, scheduled slightly ahead of time.
   * ------------------------------------------------------------------ */
  const LEAD = [
    72, 76, 79, 76, 77, 81, 79, -1, 76, 79, 84, 79, 77, 76, 74, -1,
    74, 77, 81, 77, 76, 79, 84, -1, 83, 81, 79, 77, 76, 74, 72, -1
  ];
  const BASS = [48, 55, 53, 60, 48, 55, 55, 50, 50, 57, 48, 55, 55, 50, 48, 43];

  function scheduleMusic() {
    while (nextNoteTime < ctx.currentTime + 0.12) {
      const lead = LEAD[musicStep % LEAD.length];
      if (lead > 0) {
        tone({ type: 'square', freq: hz(lead), start: nextNoteTime, dur: STEP_SECONDS * 0.9, vol: 0.045, bus: musicBus });
      }
      if (musicStep % 2 === 0) {
        const bass = BASS[(musicStep / 2) % BASS.length];
        tone({ type: 'triangle', freq: hz(bass), start: nextNoteTime, dur: STEP_SECONDS * 1.8, vol: 0.16, bus: musicBus });
      }
      nextNoteTime += STEP_SECONDS;
      musicStep++;
    }
  }

  BGQ.Audio = {
    /** Must be called from a user gesture (tap/click/key) to enable sound. */
    unlock: function () {
      if (!ensureContext()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    },

    play: function (name) {
      if (!ctx || muted || !SFX[name]) return;
      try {
        SFX[name]();
      } catch (err) {
        /* Never let an audio problem interrupt the game. */
      }
    },

    startMusic: function () {
      if (!ctx || musicTimer) return;
      musicStep = 0;
      nextNoteTime = ctx.currentTime + 0.05;
      musicTimer = window.setInterval(scheduleMusic, 30);
    },

    stopMusic: function () {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },

    /** Lowers the music while a question is on screen so kids can focus. */
    duck: function (on) {
      if (!ctx) return;
      musicBus.gain.setTargetAtTime(on ? MUSIC_VOLUME * 0.3 : MUSIC_VOLUME, ctx.currentTime, 0.15);
    },

    /** Pauses/resumes the whole audio clock (used for the pause menu and hidden tabs). */
    suspend: function (on) {
      if (!ctx) return;
      if (on && ctx.state === 'running') ctx.suspend().catch(function () {});
      if (!on && ctx.state === 'suspended') ctx.resume().catch(function () {});
    },

    isMuted: function () {
      return muted;
    },

    setMuted: function (value) {
      muted = !!value;
      BGQ.storage.set('muted', muted);
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.02);
    },

    toggleMuted: function () {
      this.setMuted(!muted);
      return muted;
    }
  };
})();
