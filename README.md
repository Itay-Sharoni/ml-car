# ML Car

Watch 3D sports cars teach themselves to drive in the browser. Each car has a small neural network for a brain; a genetic algorithm evolves the weights until the cars can finish 3 laps of a procedurally generated, hilly circuit. Every part of the learning, the car and the road is tunable live from the UI.

## Run

Needs Node.js 18 or newer.

```bash
npm install
npm run dev
```

Then open the URL it prints (normally http://localhost:5173).

`npm test` runs the learning loop without graphics and checks that the default settings learn to finish the laps.

## What you can do

- **Train** – watch a population learn, speed time up to 40×, and tune evolution, brain, car and road settings live.
- **Run champion** – pause training and send out only the best car so far for a timed solo run, with lap times, top speed and peak g. "Test on a new road" shows whether it learned to drive or just memorised the track.
- **Drive it yourself** – take the blue car with the arrow keys or WASD.

## How it works

1. **Sense** – each car casts distance rays to the road edges. Those distances plus its speed, sideways slide and spin are the network's inputs.
2. **Think** – the network outputs steering wheel and gas/brake pedal positions.
3. **Try** – a whole population drives at once, each with a different brain.
4. **Score** – fitness is distance driven, with a bonus for finishing fast.
5. **Evolve** – the best brains are kept, crossed over and mutated into the next generation.

## The car

The physics is a dynamic bicycle model, the standard simplified model of a real car:

- tyres generate cornering force from slip angle and lose grip past the limit
- each tyre has one grip budget shared between cornering and accelerating/braking
- weight shifts forward under braking and backward under power
- the engine is power-limited, with aero drag and downforce
- gravity pulls the car back on climbs and lightens it over crests
- rear-, front- or all-wheel drive, with optional ABS and traction control

## Code

| File | What it does |
| --- | --- |
| `src/sim.js` | Car physics, sensors, fitness, genetic algorithm, champion run (no rendering, runs in Node) |
| `src/brain.js` | The neural network |
| `src/track.js` | Procedural road and hill generation |
| `src/world.js` | Three.js scene, terrain, cars, cameras |
| `src/ui.js` | Control panel, dashboard, telemetry, charts |
| `src/main.js` | Wiring and the main loop |
