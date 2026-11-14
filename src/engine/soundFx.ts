import type { ArenaId } from '../arenas/roboticsLabArena';

export type SoundEvent = 'select' | 'move' | 'capture' | 'check' | 'win' | 'loss' | 'draw' | 'timeout';

class WizardSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private arena: ArenaId = 'cathedral';

  setMuted(muted: boolean) {
    this.muted = Boolean(muted);
  }

  isMuted(): boolean {
    return this.muted;
  }

  setArena(arenaId: ArenaId) {
    this.arena = arenaId === 'robotics' ? 'robotics' : 'cathedral';
  }

  getArena(): ArenaId {
    return this.arena;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  play(event: SoundEvent) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const isRobotics = this.arena === 'robotics';

    switch (event) {
      case 'select': {
        if (isRobotics) {
          this.tone(ctx, 980, 1320, 0.036, 'sine', 0.045, now);
        } else {
          this.tone(ctx, 420, 280, 0.045, 'triangle', 0.06, now);
        }
        break;
      }
      case 'move': {
        if (isRobotics) {
          // Precision servo magnetic detent + dampened titanium tap
          this.tone(ctx, 640, 420, 0.055, 'triangle', 0.055, now);
          this.tone(ctx, 190, 96, 0.085, 'sine', 0.13, now + 0.015);
        } else {
          // Carved stone placement thud + soft slide harmonic
          this.tone(ctx, 155, 82, 0.11, 'sine', 0.16, now);
          this.tone(ctx, 310, 190, 0.06, 'triangle', 0.05, now + 0.01);
        }
        break;
      }
      case 'capture': {
        if (isRobotics) {
          // Kinetic titanium impact + plasma harmonic sweep
          this.noiseBurst(ctx, 0.18, 2200, 0.15, now);
          this.tone(ctx, 220, 62, 0.19, 'sawtooth', 0.11, now);
          this.tone(ctx, 880, 340, 0.16, 'triangle', 0.075, now + 0.015);
        } else {
          // Heavy stone shatter noise burst + low impact thump + bronze chime
          this.noiseBurst(ctx, 0.24, 900, 0.18, now);
          this.tone(ctx, 120, 48, 0.22, 'sawtooth', 0.14, now);
          this.tone(ctx, 520, 320, 0.18, 'triangle', 0.07, now + 0.02);
        }
        break;
      }
      case 'check': {
        if (isRobotics) {
          this.tone(ctx, 880, 880, 0.12, 'sine', 0.08, now);
          this.tone(ctx, 1174.66, 1174.66, 0.22, 'triangle', 0.075, now + 0.08);
        } else {
          this.tone(ctx, 587.33, 587.33, 0.28, 'sine', 0.1, now);
          this.tone(ctx, 880, 880, 0.32, 'triangle', 0.06, now + 0.05);
        }
        break;
      }
      case 'win': {
        if (isRobotics) {
          this.tone(ctx, 523.25, 523.25, 0.16, 'sine', 0.08, now);
          this.tone(ctx, 659.25, 659.25, 0.18, 'sine', 0.085, now + 0.09);
          this.tone(ctx, 783.99, 783.99, 0.24, 'triangle', 0.085, now + 0.18);
          this.tone(ctx, 1046.5, 1046.5, 0.48, 'sine', 0.095, now + 0.28);
        } else {
          this.tone(ctx, 392.0, 392.0, 0.22, 'triangle', 0.09, now);
          this.tone(ctx, 493.88, 493.88, 0.22, 'triangle', 0.09, now + 0.11);
          this.tone(ctx, 587.33, 587.33, 0.36, 'triangle', 0.11, now + 0.22);
          this.tone(ctx, 783.99, 783.99, 0.55, 'sine', 0.1, now + 0.34);
        }
        break;
      }
      case 'loss': {
        if (isRobotics) {
          this.tone(ctx, 440.0, 392.0, 0.20, 'sine', 0.08, now);
          this.tone(ctx, 349.23, 293.66, 0.26, 'triangle', 0.08, now + 0.16);
          this.tone(ctx, 220.0, 174.61, 0.42, 'sine', 0.095, now + 0.34);
        } else {
          this.tone(ctx, 329.63, 311.13, 0.25, 'triangle', 0.09, now);
          this.tone(ctx, 261.63, 246.94, 0.32, 'triangle', 0.09, now + 0.18);
          this.tone(ctx, 196.0, 174.61, 0.48, 'sine', 0.11, now + 0.36);
        }
        break;
      }
      case 'draw': {
        this.tone(ctx, 440, 440, 0.2, 'sine', 0.08, now);
        this.tone(ctx, 440, 440, 0.28, 'sine', 0.07, now + 0.18);
        break;
      }
      case 'timeout': {
        this.tone(ctx, 740, 740, 0.12, 'square', 0.06, now);
        this.tone(ctx, 554.37, 554.37, 0.25, 'square', 0.06, now + 0.15);
        break;
      }
    }
  }

  private tone(
    ctx: AudioContext,
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
    startTime: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private noiseBurst(
    ctx: AudioContext,
    duration: number,
    cutoffHz: number,
    peakGain: number,
    startTime: number
  ) {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-i / sampleCount) * 3.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(startTime);
  }
}

export const soundFx = new WizardSoundEngine();

