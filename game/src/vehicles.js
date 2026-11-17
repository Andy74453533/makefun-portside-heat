// Cars: the player's ride, parked cars to steal, traffic that fills the
// roads, and police cruisers. One arcade model drives them all — throttle,
// steering and a little drift — and traffic steers itself along the road
// grid, turning at intersections.

import { CAR, WORLD } from './config.js';

const CAR_COLORS = [
  '#c94f38', '#3f7fb5', '#d9a03f', '#4f9e5f', '#8a5fa8',
  '#e8e4da', '#2e2e34', '#5fb5a8', '#d97f3f', '#7a8ba0',
];
const SPORTS_COLORS = ['#e83f2e', '#f5c542', '#22c8e8', '#ff6fb5'];

let nextId = 1;

export function makeCar(random, opts = {}) {
  const car = {
    id: nextId,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    angle: opts.angle ?? 0,
    speed: 0,
    color: opts.color ?? random.pick(CAR_COLORS),
    kind: opts.kind ?? 'sedan',
    hp: opts.hp ?? 100,
    maxHp: 100,
    driver: opts.driver ?? null, // 'player' | 'traffic' | 'police' | null (parked)
    parked: opts.parked ?? false,
    wanted: false,
    // Traffic state.
    routeAxis: opts.routeAxis ?? 'horizontal',
    routeDir: opts.routeDir ?? 1,
    routePos: opts.routePos ?? 0,
    turnCooldown: 0,
    stuckTimer: 0,
    lastX: opts.x ?? 0,
    lastY: opts.y ?? 0,
    // Police state.
    siren: opts.kind === 'police',
    // Cosmetic.
    brakeLight: false,
    steer: 0,
  };
  nextId = Math.max(nextId, car.id + 1);
  return car;
}

export function makeParkedCar(random, x, y, angle, sports) {
  return makeCar(random, {
    x, y, angle,
    color: sports ? random.pick(SPORTS_COLORS) : random.pick(CAR_COLORS),
    kind: sports ? 'sports' : random.pick(['sedan', 'hatch', 'taxi']),
    parked: true,
    driver: null,
  });
}

export function carFront(car) {
  return {
    x: car.x + Math.cos(car.angle) * (CAR.LENGTH / 2),
    y: car.y + Math.sin(car.angle) * (CAR.LENGTH / 2),
  };
}

// Arcade driving: throttle builds speed, steering turns harder at speed,
// the handbrake breaks grip so the tail slides.
export function driveCar(car, input, dt) {
  const forward = input.throttle;
  const steerInput = input.steer;
  const brake = input.brake;

  const maxSpeed = car.kind === 'sports' ? CAR.MAX_SPEED * 1.18 : CAR.MAX_SPEED;
  if (forward > 0) {
    car.speed += CAR.ACCEL * forward * dt;
  } else if (forward < 0) {
    if (car.speed > 20) car.speed -= CAR.BRAKE * dt;
    else car.speed -= CAR.REVERSE_ACCEL * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  if (brake) {
    car.speed -= Math.sign(car.speed) * 620 * dt;
    if (Math.abs(car.speed) < 12) car.speed = 0;
  }
  car.speed = Math.max(-CAR.MAX_REVERSE, Math.min(maxSpeed, car.speed));

  const speedFactor = Math.min(1, Math.abs(car.speed) / 240);
  const grip = brake ? 1.4 : CAR.GRIP;
  const turn = steerInput * CAR.TURN_RATE * speedFactor * (brake ? 1.35 : 1);
  car.angle += turn * Math.sign(car.speed || 1) * dt * (car.speed < 0 ? -1 : 1);
  car.steer = steerInput;

  const slide = brake ? 0.35 : 0.06;
  const dirX = Math.cos(car.angle);
  const dirY = Math.sin(car.angle);
  const vx = dirX * car.speed;
  const vy = dirY * car.speed;
  // A little lateral slide when the handbrake is on.
  car.x += (vx + (car._slideX ?? 0) * slide) * dt;
  car.y += (vy + (car._slideY ?? 0) * slide) * dt;
  car._slideX = (car._slideX ?? 0) * (1 - grip * dt);
  car._slideY = (car._slideY ?? 0) * (1 - grip * dt);
  car.brakeLight = brake || forward < 0;
}

// Traffic: follow the road grid. Each car keeps to its lane on one road,
// and at an intersection it sometimes turns onto the crossing road.
export function updateTrafficCar(car, city, dt, random) {
  car.turnCooldown -= dt;
  const axis = car.routeAxis;
  const pos = car.routePos;
  let targetAngle;
  if (axis === 'horizontal') {
    targetAngle = car.routeDir > 0 ? 0 : Math.PI;
    car.y += (pos - car.y) * Math.min(1, 4 * dt);
    // Lane offset so two-way traffic passes on the right.
    const lane = car.routeDir > 0 ? 22 : -22;
    car.y += (pos + lane - car.y) * Math.min(1, 4 * dt);
  } else {
    targetAngle = car.routeDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.x += (pos - car.x) * Math.min(1, 4 * dt);
    const lane = car.routeDir > 0 ? -22 : 22;
    car.x += (pos + lane - car.x) * Math.min(1, 4 * dt);
  }
  // Steer toward the road direction.
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  car.speed += (170 - car.speed) * Math.min(1, 1.5 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // At an intersection, sometimes turn.
  const nearIntersection = city.roads.some((p) => Math.abs((axis === 'horizontal' ? car.x : car.y) - p) < 30);
  if (nearIntersection && car.turnCooldown <= 0 && random.chance(0.35)) {
    const cross = city.roads[Math.floor(random.next() * city.roads.length)];
    if (axis === 'horizontal') {
      car.routeAxis = 'vertical';
      car.routePos = cross;
      car.routeDir = random.chance(0.5) ? 1 : -1;
    } else {
      car.routeAxis = 'horizontal';
      car.routePos = cross;
      car.routeDir = random.chance(0.5) ? 1 : -1;
    }
    car.turnCooldown = 4;
  }

  // Wrap around the city edge so traffic never runs out.
  if (car.x < 60) { car.x = WORLD.SIZE - 70; car.routeDir = -1; }
  if (car.x > WORLD.SIZE - 60) { car.x = 70; car.routeDir = 1; }
  if (car.y < 60) { car.y = WORLD.SIZE - 70; car.routeDir = -1; }
  if (car.y > WORLD.SIZE - 60) { car.y = 70; car.routeDir = 1; }

  // Stuck detection: if the car barely moved, nudge it back onto a road.
  const moved = Math.hypot(car.x - car.lastX, car.y - car.lastY);
  if (moved < 4 * dt * 60) {
    car.stuckTimer += dt;
    if (car.stuckTimer > 2.5) {
      const p = city.nearestRoadPoint(car.x, car.y);
      car.x = p.x; car.y = p.y;
      car.stuckTimer = 0;
    }
  } else {
    car.stuckTimer = 0;
  }
  car.lastX = car.x;
  car.lastY = car.y;
}

// Spawn parked cars along roads and in front of houses.
export function spawnParkedCars(random, city, count) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < count * 12) {
    tries += 1;
    const road = random.pick(city.roads);
    const along = random.range(300, WORLD.SIZE - 300);
    const horizontal = random.chance(0.5);
    const x = horizontal ? along : road + (random.chance(0.5) ? 62 : -62);
    const y = horizontal ? road + (random.chance(0.5) ? 62 : -62) : along;
    if (!city.isRoad(x, y)) continue;
    const angle = horizontal ? (y > road ? 0 : Math.PI) : (x > road ? Math.PI / 2 : -Math.PI / 2);
    const probe = { x, y };
    if (city.resolveCircle(probe, 30)) continue;
    cars.push(makeParkedCar(random, x, y, angle, random.chance(0.14)));
  }
  return cars;
}

export function spawnTraffic(random, city, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const road = random.pick(city.roads);
    const along = random.range(200, WORLD.SIZE - 200);
    const horizontal = random.chance(0.5);
    const car = makeCar(random, {
      x: horizontal ? along : road,
      y: horizontal ? road : along,
      angle: horizontal ? 0 : Math.PI / 2,
      kind: random.pick(['sedan', 'sedan', 'hatch', 'taxi', 'van']),
      driver: 'traffic',
      routeAxis: horizontal ? 'horizontal' : 'vertical',
      routePos: road,
      routeDir: random.chance(0.5) ? 1 : -1,
    });
    car.speed = random.range(120, 180);
    cars.push(car);
  }
  return cars;
}
