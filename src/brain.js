// A tiny fully-connected neural network (the car's "brain").
// Weights live in one flat array so evolution can treat them as a genome.
// Layout per layer, per output neuron: [bias, w_0, w_1, ... w_in-1]

export function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Brain {
  constructor(sizes, weights) {
    this.sizes = sizes;
    this.acts = sizes.map((s) => new Float32Array(s));
    if (weights) this.w = weights;
    else {
      this.w = new Float32Array(Brain.count(sizes));
      let o = 0;
      for (let l = 0; l < sizes.length - 1; l++) {
        const scale = 1.4 / Math.sqrt(sizes[l]);
        for (let j = 0; j < sizes[l + 1]; j++) {
          this.w[o++] = gauss() * 0.3;
          for (let i = 0; i < sizes[l]; i++) this.w[o++] = gauss() * scale;
        }
      }
    }
  }

  static count(sizes) {
    let c = 0;
    for (let l = 0; l < sizes.length - 1; l++) c += (sizes[l] + 1) * sizes[l + 1];
    return c;
  }

  forward(input) {
    const { sizes, acts, w } = this;
    acts[0].set(input);
    let o = 0;
    for (let l = 0; l < sizes.length - 1; l++) {
      const a = acts[l], out = acts[l + 1], nin = sizes[l];
      for (let j = 0; j < out.length; j++) {
        let s = w[o++];
        for (let i = 0; i < nin; i++) s += w[o++] * a[i];
        out[j] = Math.tanh(s);
      }
    }
    return acts[acts.length - 1];
  }

  clone() {
    return new Brain(this.sizes, Float32Array.from(this.w));
  }

  // Child genome: optionally mix with a second parent, then randomly nudge weights.
  static breed(a, b, rate, strength) {
    const w = Float32Array.from(a.w);
    if (b) for (let i = 0; i < w.length; i++) if (Math.random() < 0.5) w[i] = b.w[i];
    for (let i = 0; i < w.length; i++) if (Math.random() < rate) w[i] += gauss() * strength;
    return new Brain(a.sizes, w);
  }
}
