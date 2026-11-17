// Sound without sound files: every effect is synthesized with WebAudio
// the moment it is needed — engine hum, sirens, gunshots, pickups, and a
// small bassline that keeps the city moving. Nothing is loaded; the first
// user gesture starts the audio context.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    musicTimer: 0,
    musicStep: 0,
    enabled: true,
    started: false,

    start() {
      if (this.started) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        // Engine: a low sawtooth whose pitch follows the speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 50;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const engineFilter = this.ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        this.engineOsc.connect(engineFilter);
        engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        // Siren: a sine that swings between two notes.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this.started = true;
      } catch {
        this.started = false;
      }
    },

    setEngine(speedRatio, inCar) {
      if (!this.started || !this.enabled) return;
      const target = inCar ? 0.05 + speedRatio * 0.06 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, this.ctx.currentTime, 0.1);
    },

    setSiren(on, dt) {
      if (!this.started || !this.enabled) return;
      if (!on) {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        return;
      }
      this.sirenTimer += dt;
      const high = Math.floor(this.sirenTimer * 2.2) % 2 === 0;
      this.sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, this.ctx.currentTime, 0.05);
      this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.1);
    },

    blip(freq, duration, type = 'sine', volume = 0.12) {
      if (!this.started || !this.enabled) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    },

    noise(duration, volume = 0.2, lowpass = 1200) {
      if (!this.started || !this.enabled) return;
      const t = this.ctx.currentTime;
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * duration), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(t);
    },

    gunshot() {
      this.noise(0.12, 0.3, 900);
      this.blip(90, 0.1, 'square', 0.12);
    },

    pickup() {
      this.blip(660, 0.09);
      setTimeout(() => this.blip(990, 0.12), 70);
    },

    missionComplete() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.18, 'triangle', 0.14), i * 110));
    },

    busted() {
      const notes = [392, 330, 262];
      notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.3, 'triangle', 0.14), i * 180));
    },

    // A lazy funk bassline: one note per eighth, cycling a minor groove.
    music(dt) {
      if (!this.started || !this.enabled) return;
      this.musicTimer += dt;
      const stepDur = 0.21;
      if (this.musicTimer < stepDur) return;
      this.musicTimer -= stepDur;
      const bass = [55, 0, 55, 65.4, 0, 55, 82.4, 0, 55, 0, 55, 73.4, 0, 98, 82.4, 65.4];
      const note = bass[this.musicStep % bass.length];
      this.musicStep += 1;
      if (note > 0) this.blip(note, 0.16, 'triangle', 0.05);
      if (this.musicStep % 4 === 2) this.noise(0.03, 0.02, 6000);
    },
  };
  return audio;
}
