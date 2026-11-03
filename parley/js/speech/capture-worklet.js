// AudioWorklet that forwards raw microphone samples to the page in ~85 ms chunks.
class ParleyCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(4096);
    this.n = 0;
    this.port.onmessage = (e) => { if (e.data === 'flush') this.flush(); };
  }
  flush() {
    if (this.n) this.port.postMessage(this.buf.slice(0, this.n));
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('parley-capture', ParleyCapture);
