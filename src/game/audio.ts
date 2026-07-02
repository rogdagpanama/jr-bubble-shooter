/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterVolume: number = 0.5;

  private init() {
    if (!this.ctx) {
      // Create audio context
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    // Resume context if suspended (browser security)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  private createGainNode(duration: number): { gainNode: GainNode; destination: AudioNode } | null {
    this.init();
    if (!this.ctx) return null;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    gainNode.connect(this.ctx.destination);
    return { gainNode, destination: gainNode };
  }

  playClick() {
    if (this.masterVolume === 0) return;
    const audio = this.createGainNode(0.05);
    if (!audio || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.05);

    audio.gainNode.gain.setValueAtTime(this.masterVolume * 0.15, this.ctx.currentTime);
    audio.gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(audio.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playBuy() {
    if (this.masterVolume === 0) return;
    const audio = this.createGainNode(0.3);
    if (!audio || !this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(261.63, this.ctx.currentTime); // C4
    osc1.frequency.setValueAtTime(329.63, this.ctx.currentTime + 0.08); // E4
    osc1.frequency.setValueAtTime(392.00, this.ctx.currentTime + 0.16); // G4
    osc1.frequency.setValueAtTime(523.25, this.ctx.currentTime + 0.24); // C5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25, this.ctx.currentTime); 
    osc2.frequency.exponentialRampToValueAtTime(783.99, this.ctx.currentTime + 0.3); // G5

    audio.gainNode.gain.setValueAtTime(0.01, this.ctx.currentTime);
    audio.gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.25, this.ctx.currentTime + 0.05);
    audio.gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc1.connect(audio.destination);
    osc2.connect(audio.destination);

    osc1.start();
    osc1.stop(this.ctx.currentTime + 0.3);
    osc2.start();
    osc2.stop(this.ctx.currentTime + 0.3);
  }

  playCoin() {
    if (this.masterVolume === 0) return;
    const audio = this.createGainNode(0.25);
    if (!audio || !this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
    osc1.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.08); // E6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.51, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(2093.00, this.ctx.currentTime + 0.25); // C7

    audio.gainNode.gain.setValueAtTime(0.01, this.ctx.currentTime);
    audio.gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.2, this.ctx.currentTime + 0.04);
    audio.gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc1.connect(audio.destination);
    osc2.connect(audio.destination);

    osc1.start();
    osc1.stop(this.ctx.currentTime + 0.25);
    osc2.start();
    osc2.stop(this.ctx.currentTime + 0.25);
  }

  playLevelUp() {
    if (this.masterVolume === 0) return;
    const audio = this.createGainNode(0.6);
    if (!audio || !this.ctx) return;

    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major arpeggio
    const time = this.ctx.currentTime;

    audio.gainNode.gain.setValueAtTime(this.masterVolume * 0.25, time);
    audio.gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.6);

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time + idx * 0.06);
      
      noteGain.gain.setValueAtTime(0, time);
      noteGain.gain.setValueAtTime(0, time + idx * 0.06);
      noteGain.gain.linearRampToValueAtTime(0.15, time + idx * 0.06 + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.06 + 0.2);
      
      osc.connect(noteGain);
      noteGain.connect(audio!.destination);
      
      osc.start(time + idx * 0.06);
      osc.stop(time + idx * 0.06 + 0.25);
    });
  }

  playHorn() {
    if (this.masterVolume === 0) return;
    const audio = this.createGainNode(1.0);
    if (!audio || !this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();

    // Dual-frequency steam train whistle (typically around 350-400Hz)
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(330, this.ctx.currentTime); // E4
    // Add nice vibrato/warble
    const lfo1 = this.ctx.createOscillator();
    const lfoGain1 = this.ctx.createGain();
    lfo1.frequency.setValueAtTime(6, this.ctx.currentTime);
    lfoGain1.gain.setValueAtTime(4, this.ctx.currentTime);
    lfo1.connect(lfoGain1);
    lfoGain1.connect(osc1.frequency);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(392, this.ctx.currentTime); // G4
    const lfo2 = this.ctx.createOscillator();
    const lfoGain2 = this.ctx.createGain();
    lfo2.frequency.setValueAtTime(6, this.ctx.currentTime);
    lfoGain2.gain.setValueAtTime(4, this.ctx.currentTime);
    lfo2.connect(lfoGain2);
    lfoGain2.connect(osc2.frequency);

    // Apply lowpass filter to make it sound full and distant rather than harsh
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);

    // Dynamic envelope for realistic whistle blow
    const t = this.ctx.currentTime;
    
    // Whistle 1 (short blow)
    audio.gainNode.gain.setValueAtTime(0, t);
    audio.gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.35, t + 0.15);
    audio.gainNode.gain.setValueAtTime(this.masterVolume * 0.35, t + 0.35);
    audio.gainNode.gain.linearRampToValueAtTime(0.001, t + 0.45);
    
    // Whistle 2 (long blow)
    audio.gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.4, t + 0.55);
    audio.gainNode.gain.setValueAtTime(this.masterVolume * 0.4, t + 1.25);
    audio.gainNode.gain.linearRampToValueAtTime(0.001, t + 1.45);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(audio.destination);

    lfo1.start();
    lfo2.start();
    osc1.start();
    osc2.start();

    lfo1.stop(t + 1.5);
    lfo2.stop(t + 1.5);
    osc1.stop(t + 1.5);
    osc2.stop(t + 1.5);
  }

  // Play rhythmic steam engine chugging
  playChug(speedFactor: number) {
    if (this.masterVolume === 0) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Base frequency and filter to make it sound like puffing steam
    // We create a short noise burst with custom envelope
    const bufferSize = this.ctx.sampleRate * 0.1; // 100ms noise burst
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(150 + speedFactor * 100, t);
    filter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    // Chug should be quiet and backgrounded
    const maxVolume = this.masterVolume * 0.08 * (0.5 + speedFactor * 0.5);
    gain.gain.setValueAtTime(maxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    noise.stop(t + 0.1);
  }
}

export const gameAudio = new AudioEngine();
