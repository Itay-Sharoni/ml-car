# ML Car

Watch 3D sports cars teach themselves to drive in the browser. Each car has a small neural network for a brain; a genetic algorithm evolves the weights until the cars can finish 3 laps of a procedurally generated, hilly circuit, shifting gears themselves. Every part of the learning, the car and the road is tunable live from the UI.

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
- **Run champion** – pause training and send out the best car so far for a timed run, with lap times, top speed and peak g. Set "Cars in the champion run" above 1 and it becomes a race against the next-best brains, from a starting grid. "Test on a new road" shows whether it learned to drive or just memorised the track.
- **Drive it yourself** – take the blue car with the arrow keys or WASD, E/Q to shift up/down, X for the handbrake.

## How it works

1. **Sense** – each car casts distance rays to the road edges and feels what a driver feels: speed, g-forces, gear and revs, the hills and bends ahead (see below). Every sense is an input of the network.
2. **Think** – the network outputs the driver's moves: steering wheel, gas/brake pedal, gear shifts and handbrake.
3. **Try** – a whole population drives at once, each with a different brain.
4. **Score** – a time attack: distance earns points, pace multiplies them, finishing adds a bonus, and cars that are too slow are eliminated (see below).
5. **Evolve** – the best brains are kept, crossed over and mutated into the next generation.

## The model

The brain is a small feed-forward neural network (a multilayer perceptron with tanh neurons): by default 22 inputs, one hidden layer of 10 neurons and 4 outputs, about 270 weights. It is trained by neuroevolution, not by gradient descent: a genetic algorithm keeps the best brains of each generation, crosses them over and randomly mutates their weights. Nothing is ever told the right answer; brains that score better simply have more children.

## What the driver controls

| Control | How it works |
| --- | --- |
| Steering wheel | 1.5 turns from centre to full lock, and hands can only turn it so fast (900°/s). Both are tunable. |
| Pedal | One right foot: on the gas, on the brake, or lifted in between (coasting, with engine braking). |
| Gear shift | Manual gearbox: shift up or down one gear, like paddles. A shift briefly cuts the drive, and the gearbox refuses a downshift that would over-rev. Switch to Auto to take it away from the brain. |
| Handbrake | As hard as the brain likes. Rear wheels only, no ABS: pull hard and the rears lock and the tail steps out. |

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
- **The right gear counts** (manual gearbox). Every moment is scored by how much of the engine's possible push the chosen gear makes available: +1 in the best gear, 0 at half, -1 when bogged down or on the rev limiter. The average multiplies the score up or down ("Gear reward").
- **Drifting can count** if you turn "Drift reward" up. It is off by default.

The UI shows par, the best time, the gap between them, the leader's live pace as a percentage of par, and a chart of the best race time per generation. Cars can beat par by cutting corners on a proper racing line.

## Collisions and racing

"Car collisions" makes the cars solid to each other. They then start from a staggered grid instead of on top of one another (everyone still drives the same distance), and their distance rays see other cars as well as the road edges. It applies to training too, and it has to: a brain trained with collisions off has never seen another car and will drive straight into one.

## The car

The physics is a dynamic bicycle model, the standard simplified model of a real car:

- tyres generate cornering force from slip angle and lose grip past the limit
- each tyre has one grip budget shared between cornering and accelerating/braking
- weight shifts forward under braking and backward under power
- the engine is power-limited, with aero drag and downforce
- a six-speed gearbox: torque times gear ratio at the wheels, power peaking near 6700 rpm, a rev limiter and engine braking, so the wrong gear costs real acceleration
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
