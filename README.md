# ML Car

Watch 3D cars teach themselves to drive in the browser. Each car has a small neural network for a brain; a genetic algorithm evolves the weights until the cars can finish 3 laps of a procedurally generated road. Every part of the learning, the car and the road is tunable live from the UI.

## Run

Needs Node.js 18 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

`npm test` runs the learning loop without graphics and checks that the default settings learn to finish the laps.

## How it works

1. **Sense** – each car casts distance rays to the road edges. Those distances plus its speed are the network's inputs.
2. **Think** – the network outputs steering and gas/brake.
3. **Try** – a whole population drives at once, each with a different brain.
4. **Score** – fitness is distance driven, with a bonus for finishing fast.
5. **Evolve** – the best brains are kept, crossed over and mutated into the next generation.

## Code

| File | What it does |
| --- | --- |
| `src/sim.js` | Physics, sensors, fitness, genetic algorithm (no rendering, runs in Node) |
| `src/brain.js` | The neural network |
| `src/track.js` | Procedural road generation |
| `src/world.js` | Three.js scene, cars, cameras |
| `src/ui.js` | Control panel, telemetry, charts |
| `src/main.js` | Wiring and the main loop |
