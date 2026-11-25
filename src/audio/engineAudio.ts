export class EngineAudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;
  private muted = false;
  private initialized = false;

  public init(): void {
    if (this.initialized) {
      if (this.ctx?.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.35;
    master.connect(ctx.destination);

    // Engine dual-oscillator combustion sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.Q.value = 1.8;

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 30;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 60;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);

    osc1.start();
    osc2.start();

    // Dual-tone car horn
    const hornGain = ctx.createGain();
    hornGain.gain.value = 0;
    const hornOsc1 = ctx.createOscillator();
    const hornOsc2 = ctx.createOscillator();
    hornOsc1.type = 'sawtooth';
    hornOsc2.type = 'sawtooth';
    hornOsc1.frequency.value = 415;
    hornOsc2.frequency.value = 515;

    const hornFilter = ctx.createBiquadFilter();
    hornFilter.type = 'lowpass';
    hornFilter.frequency.value = 1600;

    hornOsc1.connect(hornFilter);
    hornOsc2.connect(hornFilter);
    hornFilter.connect(hornGain);
    hornGain.connect(master);
    hornOsc1.start();
    hornOsc2.start();

    this.ctx = ctx;
    this.masterGain = master;
    this.osc1 = osc1;
    this.osc2 = osc2;
    this.engineGain = engineGain;
    this.filter = filter;
    this.hornGain = hornGain;
    this.hornOsc1 = hornOsc1;
    this.hornOsc2 = hornOsc2;
    this.initialized = true;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.35, this.ctx.currentTime, 0.04);
    }
  }

  public updateEngine(rpm: number, running: boolean, cranking: boolean, throttle: number, horn: boolean): void {
    if (!this.ctx || !this.osc1 || !this.osc2 || !this.engineGain || !this.filter || !this.hornGain) return;
    const now = this.ctx.currentTime;

    if (running || cranking) {
      const baseFreq = cranking ? 18 : 24 + (rpm / 6500) * 115;
      this.osc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
      this.osc2.frequency.setTargetAtTime(baseFreq * 2.01, now, 0.04);
      this.filter.frequency.setTargetAtTime(cranking ? 130 : 140 + (rpm / 6500) * 520 + throttle * 200, now, 0.05);
      this.engineGain.gain.setTargetAtTime(cranking ? 0.16 : 0.12 + throttle * 0.1, now, 0.05);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
    }

    this.hornGain.gain.setTargetAtTime(horn ? 0.18 : 0, now, 0.02);
  }

  public playIndicatorTick(high: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 1150 : 880, now);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playHandbrakeRatchet(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.035;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(340 + i * 70, t);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.03);
    }
  }

  public playGearGrind(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(65, now + 0.18);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playConeBump(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playCheckpointChime(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
