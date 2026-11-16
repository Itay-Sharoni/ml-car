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

1. **Sense** – each car casts distance rays to the road edges and feels what a driver feels: speed, g-forces, gear and revs, the hills and bends ahead (see below). Every sense is an input of the network.
2. **Think** – the network outputs steering wheel and gas/brake pedal positions.
3. **Try** – a whole population drives at once, each with a different brain.
4. **Score** – a time attack: distance earns points, pace multiplies them, finishing adds a bonus, and cars that are too slow are eliminated (see below).
5. **Evolve** – the best brains are kept, crossed over and mutated into the next generation.

## What the driver senses

Each sense can be switched on or off under "Driver's senses". The "What the driver feels" panel shows every input live, in real units, for the car being watched.

| Sense | Inputs |
| --- | --- |
| Eyes | 3 to 15 distance rays to the road edges |
| Speed & balance | speed, sideways slide, spin |
| G-forces | accelerating/braking g, cornering g, vertical g (light over crests, heavy in dips) |
| Gear & revs | gear of the automatic gearbox, engine rpm |
| Depth: hills | slope under the car, rise or fall of the road over the next 40 m and 100 m |
| Depth: bends ahead | which way the road points 40 m and 100 m ahead of the nose |
| Place on the road | distance left or right of the centre line, angle to the road |
| Tyre feel | front and rear tyre slip angle |
| Hands & feet | current steering wheel and pedal position |

On by default: eyes, speed & balance, g-forces, gear & revs, hills and bends ahead.

More senses are not automatically better. Every input adds connections that a random mutation can break, so a bigger brain learns more slowly unless mutation gets gentler. The senses beyond eyes and speed are therefore fed in at reduced strength (the "Sense strength" slider, 20% by default), and the default mutation rate is tuned for the default set. It is a trade-off you can try yourself: in 10 test runs each, eyes and speed alone first finished the race around generation 11 against 24 for the default set, but after 70 generations the default set was about 6 s quicker over 3 laps (median 126 s against 132 s). Reading the bends ahead gives most of that gain. With every sense switched on, 3 runs in 10 had not finished by generation 70.

## Scoring: racing the clock

Every circuit has a **par time**: what an ideal driver would do following the centre line at the limit of the current car's grip, power and brakes. Par is the yardstick for "fast" and "slow".

- **Distance is the base.** A car must stay on the road to score at all.
- **Pace multiplies it.** Faster than half of par pace earns a bonus, slower costs points. The "Speed reward" slider sets how strongly.
- **Finishing adds a full extra race distance**, so finishers always outrank non-finishers, and among finishers the quickest time wins.
- **Too slow means out.** Cars that fall behind the "Minimum pace" (40% of par by default) are eliminated.

The UI shows par, the best time, the gap between them, the leader's live pace as a percentage of par, and a chart of the best race time per generation. Cars can beat par by cutting corners on a proper racing line.

## The car

The physics is a dynamic bicycle model, the standard simplified model of a real car:

- tyres generate cornering force from slip angle and lose grip past the limit
- each tyre has one grip budget shared between cornering and accelerating/braking
- weight shifts forward under braking and backward under power
- the engine is power-limited, with aero drag and downforce
- a six-speed automatic gearbox: the engine makes full power only near the top of the rev range, so thrust dips after each upshift
- gravity pulls the car back on climbs and lightens it over crests
- rear-, front- or all-wheel drive, with optional ABS and traction control

## Code

| File | What it does |
| --- | --- |
| `src/sim.js` | Car physics, senses, fitness, genetic algorithm, champion run (no rendering, runs in Node) |
| `src/brain.js` | The neural network |
| `src/track.js` | Procedural road and hill generation |
| `src/world.js` | Three.js scene, terrain, cars, cameras |
| `src/ui.js` | Control panel, dashboard, telemetry, charts |
| `src/main.js` | Wiring and the main loop |
