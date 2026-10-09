export class Sfx {
  private ctx: AudioContext | null = null;
  private scoreNodes: AudioNode[] = [];
  private noise: AudioBuffer | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const len = this.ctx.sampleRate * 1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  private env(gain: GainNode, t: number, a: number, d: number, peak: number): void {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  click(): void {
    this.tone(620, 0.04, 0.05, "square", 0.04);
  }

  bad(): void {
    this.tone(140, 0.08, 0.18, "sawtooth", 0.05);
  }

  build(): void {
    this.tone(220, 0.04, 0.12, "triangle", 0.05);
    this.tone(440, 0.06, 0.16, "sine", 0.04);
  }

  shot(kind: string): void {
    if (kind === "rocket") this.noiseBurst(180, 0.18, 0.07);
    else if (kind === "shell") this.noiseBurst(90, 0.09, 0.08);
    else this.tone(880, 0.01, 0.05, "square", 0.03);
  }

  boom(big: boolean): void {
    this.noiseBurst(big ? 70 : 140, big ? 0.4 : 0.2, big ? 0.12 : 0.07);
  }

  win(): void {
    this.tone(523, 0.02, 0.2, "triangle", 0.06);
    this.tone(659, 0.12, 0.22, "triangle", 0.05);
    this.tone(784, 0.22, 0.34, "sine", 0.05);
  }

  lose(): void {
    this.tone(196, 0.02, 0.3, "sawtooth", 0.05);
    this.tone(130, 0.2, 0.4, "triangle", 0.05);
  }

  startScore(): void {
    this.unlock();
    this.stopScore();
    const ctx = this.ctx;
    if (!ctx) return;
    void ctx.resume();
    const notes = [262, 330, 392, 523, 392, 330];
    let step = 0;
    const tick = () => {
      this.tone(notes[step % notes.length], 0, 0.42, "triangle", 0.16);
      this.tone(notes[step % notes.length] / 2, 0, 0.5, "sine", 0.08);
      step += 1;
    };
    tick();
    this.musicTimer = setInterval(tick, 680);
  }

  stopScore(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    for (const n of this.scoreNodes) {
      try {
        if ("stop" in n && typeof (n as OscillatorNode).stop === "function") (n as OscillatorNode).stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.scoreNodes = [];
  }

  private tone(freq: number, delay: number, dur: number, type: OscillatorType, peak: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.01, dur, peak);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(freq: number, dur: number, peak: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 8, t);
    f.frequency.exponentialRampToValueAtTime(freq, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.01, dur, peak);
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
