// The people of Portside: the player on foot, pedestrians who stroll the
// sidewalks and scatter from danger, and the police — patrol cars that
// answer the wanted level and chase the player down.

import { PLAYER, WANTED } from './config.js';
import { makeCar } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    radius: PLAYER.RADIUS,
    hp: PLAYER.HEALTH,
    maxHp: PLAYER.HEALTH,
    armor: 0,
    inCar: null,
    speed: 0,
    aimAngle: -Math.PI / 2,
    fireCooldown: 0,
    weapon: 'pistol',
    ammo: { pistol: Infinity, smg: 0 },
    downTimer: 0,
    invulnerable: 0,
  };
}

export function makePedestrian(random, x, y) {
  return {
    x, y,
    angle: random.range(0, Math.PI * 2),
    speed: random.range(28, 52),
    color: random.pick(['#e8b04b', '#7fb5d9', '#c96f7a', '#8fae6a', '#b08fd9', '#e8e4da', '#d97f3f']),
    state: 'walk', // walk | flee | down
    stateTimer: random.range(0, 4),
    targetX: x,
    targetY: y,
    downTimer: 0,
    walkPhase: random.range(0, Math.PI * 2),
  };
}

export function spawnPedestrians(random, city, count) {
  const peds = [];
  let tries = 0;
  while (peds.length < count && tries < count * 10) {
    tries += 1;
    const x = random.range(150, 3050);
    const y = random.range(150, 3050);
    if (city.isRoad(x, y)) continue;
    const probe = { x, y };
    if (city.resolveCircle(probe, 16)) continue;
    peds.push(makePedestrian(random, x, y));
  }
  return peds;
}

function pickSidewalkTarget(ped, city, random) {
  // Wander to a nearby point that is not on a road and not inside a building.
  for (let i = 0; i < 8; i += 1) {
    const x = ped.x + random.range(-320, 320);
    const y = ped.y + random.range(-320, 320);
    if (!city.insideWorld(x, y)) continue;
    if (city.isRoad(x, y)) continue;
    const probe = { x, y };
    if (city.resolveCircle(probe, 14)) continue;
    return { x, y };
  }
  return { x: ped.x, y: ped.y };
}

export function updatePedestrian(ped, city, dt, random, danger) {
  ped.walkPhase += dt * 6;
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      ped.state = 'flee';
      ped.stateTimer = 2.5;
    }
    return;
  }
  if (danger && ped.state !== 'flee') {
    ped.state = 'flee';
    ped.stateTimer = 2.5;
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.targetX = ped.x + (dx / d) * 260;
    ped.targetY = ped.y + (dy / d) * 260;
  }
  ped.stateTimer -= dt;
  if (ped.stateTimer <= 0) {
    if (ped.state === 'flee') {
      ped.state = 'walk';
      ped.stateTimer = random.range(2, 6);
    }
    const t = pickSidewalkTarget(ped, city, random);
    ped.targetX = t.x;
    ped.targetY = t.y;
    ped.stateTimer = random.range(2, 6);
  }
  const dx = ped.targetX - ped.x;
  const dy = ped.targetY - ped.y;
  const d = Math.hypot(dx, dy);
  if (d > 6) {
    const speed = ped.state === 'flee' ? ped.speed * 2.4 : ped.speed;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * speed * dt;
    ped.y += (dy / d) * speed * dt;
    city.resolveCircle(ped, 12);
  }
}

// The wanted system: crimes raise stars, the heat decays when the player
// stays clean and unseen, and police cars spawn to match the level.
export function createWanted() {
  return {
    stars: 0,
    heat: 0, // 0..1 progress toward the next star
    decayTimer: 0,
    quietTimer: 0,
    lastCrimeAt: -100,
  };
}

export function addWanted(wanted, amount, now) {
  wanted.stars = Math.min(WANTED.MAX, wanted.stars + amount);
  wanted.lastCrimeAt = now;
  wanted.quietTimer = 0;
  wanted.decayTimer = 0;
}

export function updateWanted(wanted, dt, now, policeNear) {
  if (wanted.stars === 0) return;
  if (now - wanted.lastCrimeAt > 8 && !policeNear) {
    wanted.quietTimer += dt;
  } else {
    wanted.quietTimer = 0;
  }
  if (wanted.quietTimer > WANTED.DECAY_SECONDS) {
    wanted.stars -= 1;
    wanted.quietTimer = 0;
    wanted.lastCrimeAt = now;
  }
}

export function makePoliceCar(random, x, y) {
  const car = makeCar(random, {
    x, y, angle: 0,
    color: '#1c1c22',
    kind: 'police',
    driver: 'police',
  });
  car.siren = true;
  car.hp = 140;
  car.maxHp = 140;
  return car;
}

// Police pursuit: steer the cruiser at the player, slide along buildings
// when blocked, and ram. On foot the player is cornered when a cruiser
// stays touching for a while.
export function updatePoliceCar(car, target, city, dt) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const desired = Math.atan2(dy, dx);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const throttle = dist > 90 ? 1 : 0.4;
  const speedBefore = car.speed;
  // Reuse the arcade model through a small local driver.
  const maxSpeed = 600;
  car.speed += 460 * throttle * dt;
  car.speed = Math.min(maxSpeed, car.speed);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 240);
  car.angle += steer * 2.8 * speedFactor * dt * (car.speed < 0 ? -1 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  if (city.resolveCircle(car, 20)) {
    // Sliding along a wall bleeds speed but keeps the chase alive.
    car.speed *= 0.86;
    if (Math.hypot(car.x - before.x, car.y - before.y) < 1 && Math.abs(car.speed) > 60) {
      car.angle += 0.9 * dt * (Math.sin(car.angle) > 0 ? 1 : -1);
    }
  }
  if (!city.insideWorld(car.x, car.y)) {
    car.x = Math.max(40, Math.min(3160, car.x));
    car.y = Math.max(40, Math.min(3160, car.y));
  }
  return speedBefore;
}

// Spawn a police car on a road near the player, out of direct sight.
export function spawnPoliceNear(random, city, player, existing) {
  const spots = [];
  for (const p of city.roads) {
    spots.push({ x: p, y: player.y + 500 });
    spots.push({ x: p, y: player.y - 500 });
    spots.push({ x: player.x + 500, y: p });
    spots.push({ x: player.x - 500, y: p });
  }
  for (let i = 0; i < 6; i += 1) {
    const s = random.pick(spots);
    const x = Math.max(80, Math.min(3120, s.x + random.range(-120, 120)));
    const y = Math.max(80, Math.min(3120, s.y + random.range(-120, 120)));
    if (Math.hypot(x - player.x, y - player.y) < 380) continue;
    const probe = { x, y };
    if (city.resolveCircle(probe, 24)) continue;
    if (existing.some((c) => Math.hypot(c.x - x, c.y - y) < 200)) continue;
    return makePoliceCar(random, x, y);
  }
  return makePoliceCar(random, player.x + 500, player.y);
}
