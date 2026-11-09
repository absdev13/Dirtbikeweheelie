export class BikeAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isRunning: boolean = false;

  // Continuous engine nodes
  private oscPrimary: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Scrape continuous noise
  private scrapeGain: GainNode | null = null;
  private scrapeFilter: BiquadFilterNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Primary engine oscillator
      this.oscPrimary = this.ctx.createOscillator();
      this.oscSub = this.ctx.createOscillator();
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.oscPrimary.type = 'sawtooth';
      this.oscSub.type = 'square';

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 340;
      this.engineFilter.Q.value = 3.5;

      this.engineGain.gain.value = 0;

      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.45;

      this.oscPrimary.connect(this.engineFilter);
      this.oscSub.connect(subGain);
      subGain.connect(this.engineFilter);

      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.oscPrimary.start();
      this.oscSub.start();

      // Setup continuous scrape noise generator
      const bufferSize = this.ctx.sampleRate * 1.5;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      this.scrapeFilter = this.ctx.createBiquadFilter();
      this.scrapeFilter.type = 'bandpass';
      this.scrapeFilter.frequency.value = 2900;
      this.scrapeFilter.Q.value = 4.2;

      this.scrapeGain = this.ctx.createGain();
      this.scrapeGain.gain.value = 0;

      whiteNoise.connect(this.scrapeFilter);
      this.scrapeFilter.connect(this.scrapeGain);
      this.scrapeGain.connect(this.ctx.destination);
      whiteNoise.start();

      this.isRunning = true;
    } catch {
      // Fallback if Web Audio is blocked
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx && this.engineGain && this.scrapeGain) {
      const now = this.ctx.currentTime;
      if (muted) {
        this.engineGain.gain.setTargetAtTime(0, now, 0.04);
        this.scrapeGain.gain.setTargetAtTime(0, now, 0.03);
      }
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public updateEngine(
    rpm: number,
    maxRpm: number,
    throttle: number,
    isTwoStroke: boolean,
    isScraping: boolean,
    isPlaying: boolean
  ) {
    if (!this.ctx || !this.isRunning || !this.oscPrimary || !this.oscSub || !this.engineFilter || !this.engineGain || !this.scrapeGain || !this.scrapeFilter) {
      return;
    }

    const now = this.ctx.currentTime;
    if (this.isMuted || !isPlaying) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.scrapeGain.gain.setTargetAtTime(0, now, 0.03);
      return;
    }

    const rpmNorm = Math.max(0.12, Math.min(1.05, rpm / maxRpm));
    // Rev limiter flutter near redline
    const revFlutter = rpmNorm > 0.95 ? Math.sin(now * 95) * 14 : 0;

    // 2-stroke fires every revolution (higher pitch & rasp), 4-stroke fires every 2nd revolution (deeper thump)
    const baseFreq = isTwoStroke ? 46 + rpmNorm * 165 + revFlutter : 32 + rpmNorm * 112 + revFlutter;
    this.oscPrimary.frequency.setTargetAtTime(baseFreq, now, 0.025);
    this.oscSub.frequency.setTargetAtTime(isTwoStroke ? baseFreq * 0.5 : baseFreq * 0.5, now, 0.025);

    const filterCutoff = isTwoStroke
      ? 280 + rpmNorm * 1250 + throttle * 550
      : 190 + rpmNorm * 820 + throttle * 380;
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.03);

    const targetGain = 0.032 + throttle * 0.028 + rpmNorm * 0.015;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.04);

    // Titanium tail scrape metallic sizzle
    if (isScraping) {
      const scrapeMod = 2600 + Math.sin(now * 48) * 650;
      this.scrapeFilter.frequency.setTargetAtTime(scrapeMod, now, 0.02);
      this.scrapeGain.gain.setTargetAtTime(0.055, now, 0.02);
    } else {
      this.scrapeGain.gain.setTargetAtTime(0, now, 0.03);
    }
  }

  public playClutchPop() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playGearShift(up: boolean) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const startFreq = up ? 240 : 320;
    const endFreq = up ? 390 : 190;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.065);

    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playBrakeTap() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.065);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playSuspensionThud(intensity: number = 0.6) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const clamped = Math.min(1, Math.max(0.2, intensity));
    osc.frequency.setValueAtTime(125 * clamped + 40, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.14);

    gain.gain.setValueAtTime(0.11 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playTrickChime(comboLevel: number = 1) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const baseFreq = 440 * Math.pow(1.06, Math.min(comboLevel, 10));
    const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.055, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.23);
    });
  }

  public playCrash() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Low impact punch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.38);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  }
}

export const bikeAudio = new BikeAudioEngine();
