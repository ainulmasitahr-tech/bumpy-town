import { PotholeSeverity } from './types';

export type MusicMode = 'none' | 'marimba' | 'arcade';

class SoundController {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private muted = false;
  private musicMode: MusicMode = 'none';
  private stepIndex = 0;
  private schedulerTimer: number | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.muted ? 0 : 0.22;
      this.musicGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.muted ? 0 : 0.9;
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.musicGain && this.sfxGain) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.setTargetAtTime(muted ? 0 : 0.22, now, 0.03);
      this.sfxGain.gain.setTargetAtTime(muted ? 0 : 0.9, now, 0.02);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock() {
    const ctx = this.ensureContext();
    if (ctx && this.musicMode !== 'none' && this.schedulerTimer === null) {
      this.startSequencer();
    }
  }

  public setMusicMode(mode: MusicMode) {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.stepIndex = 0;

    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    if (mode !== 'none' && this.ctx && this.ctx.state === 'running') {
      this.startSequencer();
    }
  }

  private startSequencer() {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.musicMode === 'none') return;

    const intervalMs = this.musicMode === 'marimba' ? 240 : 190; // ~125 BPM eighth notes vs ~158 BPM sunny arcade
    this.playMusicStep();
    this.schedulerTimer = window.setInterval(() => {
      this.playMusicStep();
    }, intervalMs);
  }

  private playMarimbaNote(freq: number, time: number, duration: number, vol = 0.22) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 4, time); // wooden bar harmonic

    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.18, time);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    overtone.start(time);
    osc.stop(time + duration + 0.02);
    overtone.stop(time + 0.07);
  }

  private playArcadeNote(
    freq: number,
    time: number,
    duration: number,
    type: OscillatorType,
    vol: number,
  ) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private playSoftPerc(time: number, isKick: boolean) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (isKick) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(52, time + 0.09);
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.11);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, time);
      osc.frequency.exponentialRampToValueAtTime(420, time + 0.035);
      gain.gain.setValueAtTime(0.055, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.045);
    }
  }

  private playMusicStep() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + 0.02;

    if (this.musicMode === 'marimba') {
      // Cheerful 16-step C-major toybox marimba loop
      const melody = [
        523.25, 0, 659.25, 783.99,
        659.25, 0, 587.33, 523.25,
        440.0, 523.25, 659.25, 0,
        587.33, 659.25, 783.99, 0,
        698.46, 0, 880.0, 783.99,
        659.25, 0, 587.33, 523.25,
        587.33, 659.25, 783.99, 659.25,
        523.25, 0, 392.0, 0,
      ];
      const bass = [
        130.81, 0, 0, 0, 196.0, 0, 0, 0,
        220.0, 0, 0, 0, 196.0, 0, 0, 0,
        174.61, 0, 0, 0, 130.81, 0, 0, 0,
        196.0, 0, 0, 0, 130.81, 0, 196.0, 0,
      ];
      const idx = this.stepIndex % melody.length;
      if (melody[idx] > 0) {
        this.playMarimbaNote(melody[idx], now, 0.28, 0.22);
      }
      if (bass[idx] > 0) {
        this.playMarimbaNote(bass[idx], now, 0.36, 0.16);
      }
      if (idx % 2 === 1) {
        this.playSoftPerc(now, false);
      }
      this.stepIndex++;
      return;
    }

    if (this.musicMode === 'arcade') {
      // Upbeat 32-step Sunny Arcade Driving loop
      const lead = [
        523.25, 659.25, 783.99, 0, 1046.5, 0, 783.99, 659.25,
        587.33, 698.46, 880.0, 0, 783.99, 0, 659.25, 587.33,
        523.25, 659.25, 783.99, 880.0, 1046.5, 880.0, 783.99, 659.25,
        698.46, 783.99, 880.0, 987.77, 1046.5, 0, 783.99, 0,
      ];
      const bass = [
        130.81, 0, 261.63, 0, 196.0, 0, 261.63, 0,
        174.61, 0, 349.23, 0, 196.0, 0, 392.0, 0,
        220.0, 0, 440.0, 0, 174.61, 0, 349.23, 0,
        196.0, 0, 392.0, 0, 130.81, 0, 196.0, 0,
      ];
      const idx = this.stepIndex % lead.length;
      if (lead[idx] > 0) {
        this.playArcadeNote(lead[idx], now, 0.18, 'triangle', 0.18);
      }
      if (bass[idx] > 0) {
        this.playArcadeNote(bass[idx], now, 0.16, 'sine', 0.2);
      }
      if (idx % 4 === 0) {
        this.playSoftPerc(now, true);
      } else if (idx % 2 === 1) {
        this.playSoftPerc(now, false);
      }
      this.stepIndex++;
    }
  }

  public playClick() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playCarPick() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.09);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playPotholePop(severity: PotholeSeverity, streak = 1) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const pitchBoost = Math.min(streak - 1, 8) * 34;

    if (severity === 'high') {
      const boing = ctx.createOscillator();
      const boingGain = ctx.createGain();
      boing.type = 'triangle';
      boing.frequency.setValueAtTime(140, now);
      boing.frequency.exponentialRampToValueAtTime(520, now + 0.18);
      boingGain.gain.setValueAtTime(0.24, now);
      boingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      boing.connect(boingGain);
      boingGain.connect(this.sfxGain);
      boing.start(now);
      boing.stop(now + 0.24);

      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const t = now + idx * 0.05;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t);
        osc.stop(t + 0.22);
      });
      return;
    }

    if (severity === 'medium') {
      const boing = ctx.createOscillator();
      const boingGain = ctx.createGain();
      boing.type = 'triangle';
      boing.frequency.setValueAtTime(180 + pitchBoost * 0.3, now);
      boing.frequency.exponentialRampToValueAtTime(460 + pitchBoost, now + 0.16);
      boingGain.gain.setValueAtTime(0.22, now);
      boingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      boing.connect(boingGain);
      boingGain.connect(this.sfxGain);
      boing.start(now);
      boing.stop(now + 0.21);

      [587.33, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + idx * 0.06;
        osc.frequency.setValueAtTime(freq + pitchBoost * 0.5, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t);
        osc.stop(t + 0.2);
      });
      return;
    }

    const boing = ctx.createOscillator();
    const boingGain = ctx.createGain();
    boing.type = 'triangle';
    boing.frequency.setValueAtTime(190 + pitchBoost * 0.4, now);
    boing.frequency.exponentialRampToValueAtTime(420 + pitchBoost, now + 0.14);
    boingGain.gain.setValueAtTime(0.2, now);
    boingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    boing.connect(boingGain);
    boingGain.connect(this.sfxGain);
    boing.start(now);
    boing.stop(now + 0.18);

    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(660 + pitchBoost, now + 0.03);
    chime.frequency.exponentialRampToValueAtTime(980 + pitchBoost, now + 0.16);
    chimeGain.gain.setValueAtTime(0.13, now + 0.03);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    chime.connect(chimeGain);
    chimeGain.connect(this.sfxGain);
    chime.start(now + 0.03);
    chime.stop(now + 0.21);
  }

  public playHonk() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const toots = [0, 0.13];
    toots.forEach((offset) => {
      const t = now + offset;
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const gain = ctx.createGain();
      oscA.type = 'sawtooth';
      oscB.type = 'triangle';
      oscA.frequency.setValueAtTime(392, t);
      oscB.frequency.setValueAtTime(493.88, t);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);

      oscA.start(t);
      oscB.start(t);
      oscA.stop(t + 0.12);
      oscB.stop(t + 0.12);
    });
  }

  public playPedestrianBabble() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Funny angry cartoon babble syllables ("blab-blab-grr-blub!")
    const syllables = [
      { f1: 310, f2: 430, d: 0.075 },
      { f1: 420, f2: 260, d: 0.065 },
      { f1: 360, f2: 520, d: 0.08 },
      { f1: 480, f2: 290, d: 0.07 },
      { f1: 330, f2: 470, d: 0.075 },
      { f1: 410, f2: 210, d: 0.11 },
    ];

    let offset = 0;
    syllables.forEach((s) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(s.f1, t);
      osc.frequency.linearRampToValueAtTime(s.f2, t + s.d);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950 + Math.random() * 450, t);
      filter.Q.value = 2.5;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + s.d);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + s.d + 0.01);
      offset += s.d + 0.018;
    });
  }

  public playPoliceSiren() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Funny cartoon "WEE-WOO WEE-WOO!" siren
    const cycles = [0, 0.36, 0.72, 1.08];
    cycles.forEach((offset, idx) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const fStart = idx % 2 === 0 ? 640 : 880;
      const fEnd = idx % 2 === 0 ? 880 : 620;
      osc.frequency.setValueAtTime(fStart, t);
      osc.frequency.linearRampToValueAtTime(fEnd, t + 0.32);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  public playGreenLight() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const notes = [587.33, 880];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  public playLevelUp() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5];
    melody.forEach((freq, i) => {
      const t = now + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}

export const soundFX = new SoundController();
