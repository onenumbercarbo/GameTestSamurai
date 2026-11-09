/**
 * audio.js — Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
 * O navegador só libera o áudio após um gesto do usuário: Sfx.unlock() é
 * chamado no primeiro clique/tecla.
 */
const Sfx = (() => {
  let ac = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.4;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function env(g, t0, attack, dur, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function noise(dur, o = {}) {
    if (!ac) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ac.createGain();
    env(g, t0, o.attack || 0.005, dur, o.gain || 0.4);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function tone(freq, dur, o = {}) {
    if (!ac) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    const g = ac.createGain();
    env(g, t0, o.attack || 0.005, dur, o.gain || 0.3);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Chuva contínua: ruído em loop filtrado, liga/desliga suavemente.
  let rainSrc = null, rainGain = null;
  function setRain(on) {
    if (!ac) return;
    if (on && !rainSrc) {
      rainSrc = ac.createBufferSource();
      rainSrc.buffer = noiseBuf;
      rainSrc.loop = true;
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 0.4;
      rainGain = ac.createGain();
      rainGain.gain.value = 0.0001;
      rainSrc.connect(f).connect(rainGain).connect(master);
      rainSrc.start();
      rainGain.gain.exponentialRampToValueAtTime(0.09, ac.currentTime + 1.5);
    } else if (!on && rainSrc) {
      const src = rainSrc;
      rainGain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1);
      src.stop(ac.currentTime + 1.1);
      rainSrc = null;
    }
  }

  return {
    unlock: ensure,
    setRain,
    thunder(delay = 0.4) {
      noise(2.2, { type: 'lowpass', freq: 380, gain: 0.7, attack: 0.04, delay, sweepTo: 90 });
      noise(0.4, { type: 'lowpass', freq: 1500, gain: 0.35, delay, sweepTo: 300 });
    },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.4;
      return muted;
    },
    swing(step = 0) { noise(0.17, { freq: 2600 + step * 500, q: 0.9, gain: 0.3, sweepTo: 700 }); },
    hit(big) {
      noise(0.12, { type: 'lowpass', freq: 1400, gain: 0.6 });
      tone(big ? 75 : 120, 0.2, { type: 'triangle', gain: 0.5, slideTo: 40 });
    },
    clang() { tone(1900, 0.25, { type: 'square', gain: 0.05 }); tone(2870, 0.35, { gain: 0.08 }); },
    dash() { noise(0.22, { freq: 500, q: 0.7, gain: 0.25, sweepTo: 2600 }); },
    hurt() { tone(170, 0.28, { type: 'sawtooth', gain: 0.18, slideTo: 60 }); noise(0.1, { type: 'lowpass', freq: 600, gain: 0.5 }); },
    shot() { noise(0.18, { type: 'lowpass', freq: 2400, gain: 0.7, sweepTo: 300 }); tone(90, 0.15, { type: 'square', gain: 0.12, slideTo: 40 }); },
    throwK() { noise(0.12, { freq: 3500, q: 2, gain: 0.15, sweepTo: 1500 }); },
    smoke() { noise(0.35, { type: 'lowpass', freq: 900, gain: 0.25, sweepTo: 200 }); },
    roar() {
      tone(95, 1.3, { type: 'sawtooth', gain: 0.22, slideTo: 55, attack: 0.08 });
      tone(142, 1.1, { type: 'sawtooth', gain: 0.12, slideTo: 80, attack: 0.1 });
      noise(1.1, { type: 'lowpass', freq: 500, gain: 0.35, attack: 0.1 });
    },
    slam() { tone(60, 0.7, { gain: 0.8, slideTo: 28 }); noise(0.5, { type: 'lowpass', freq: 500, gain: 0.8 }); },
    pickup() { tone(660, 0.12, { gain: 0.15 }); tone(990, 0.2, { gain: 0.15, delay: 0.08 }); },
    gong() { tone(147, 2.6, { gain: 0.3, attack: 0.01 }); tone(296, 2.0, { gain: 0.1 }); tone(443, 1.4, { gain: 0.05 }); },
    death() { tone(220, 0.9, { type: 'triangle', gain: 0.25, slideTo: 55 }); },
  };
})();
