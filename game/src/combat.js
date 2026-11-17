// Combat: guns, bullets, gang members who fight back, and the particles
// that make a shootout read at a glance — muzzle flashes, tracers, smoke
// and the cash that pops out of a job well done.

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 26, fireRate: 0.34, bulletSpeed: 900, spread: 0.05, range: 520, auto: false },
  smg: { name: 'SMG', damage: 15, fireRate: 0.09, bulletSpeed: 980, spread: 0.11, range: 460, auto: true },
};

export function makeBullet(x, y, angle, weapon, fromPlayer) {
  const spec = WEAPONS[weapon];
  return {
    x, y,
    vx: Math.cos(angle) * spec.bulletSpeed,
    vy: Math.sin(angle) * spec.bulletSpeed,
    damage: spec.damage,
    range: spec.range,
    traveled: 0,
    fromPlayer,
    life: 1,
  };
}

export function makeEnemy(random, x, y, kind = 'viper') {
  const tough = kind === 'boss';
  return {
    x, y,
    angle: random.range(0, Math.PI * 2),
    radius: 13,
    hp: tough ? 320 : 55,
    maxHp: tough ? 320 : 55,
    kind,
    name: tough ? 'Rico Vane' : random.pick(['Viper', 'Viper', 'Viper', 'Snake', 'Ghost']),
    speed: tough ? 120 : 95,
    fireCooldown: random.range(0.4, 1.2),
    state: 'idle', // idle | hunt | flee
    stateTimer: random.range(1, 3),
    targetX: x,
    targetY: y,
    downTimer: 0,
    flash: 0,
  };
}

// An enemy spots the player, closes in, and shoots when it has a line.
export function updateEnemy(enemy, player, playerPos, city, dt, random, bullets) {
  enemy.flash = Math.max(0, enemy.flash - dt * 6);
  const dx = playerPos.x - enemy.x;
  const dy = playerPos.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  const seesPlayer = dist < 560;
  enemy.stateTimer -= dt;
  if (seesPlayer) {
    enemy.state = 'hunt';
    enemy.angle = Math.atan2(dy, dx);
    if (dist > 300) {
      enemy.x += (dx / dist) * enemy.speed * dt;
      enemy.y += (dy / dist) * enemy.speed * dt;
    } else if (dist < 170) {
      enemy.x -= (dx / dist) * enemy.speed * 0.6 * dt;
      enemy.y -= (dy / dist) * enemy.speed * 0.6 * dt;
    }
    city.resolveCircle(enemy, 12);
    enemy.fireCooldown -= dt;
    if (enemy.fireCooldown <= 0 && dist < 480) {
      const aim = Math.atan2(dy, dx) + random.range(-0.12, 0.12);
      bullets.push(makeBullet(
        enemy.x + Math.cos(aim) * 18,
        enemy.y + Math.sin(aim) * 18,
        aim, 'pistol', false,
      ));
      enemy.fireCooldown = enemy.kind === 'boss' ? 0.55 : random.range(0.8, 1.5);
      enemy.flash = 1;
    }
  } else if (enemy.stateTimer <= 0) {
    enemy.state = 'idle';
    enemy.targetX = enemy.x + random.range(-160, 160);
    enemy.targetY = enemy.y + random.range(-160, 160);
    enemy.stateTimer = random.range(2, 5);
  }
  if (enemy.state === 'idle') {
    const tdx = enemy.targetX - enemy.x;
    const tdy = enemy.targetY - enemy.y;
    const td = Math.hypot(tdx, tdy);
    if (td > 8) {
      enemy.angle = Math.atan2(tdy, tdx);
      enemy.x += (tdx / td) * enemy.speed * 0.45 * dt;
      enemy.y += (tdy / td) * enemy.speed * 0.45 * dt;
      city.resolveCircle(enemy, 12);
    }
  }
}

export function makeParticle(x, y, kind, random) {
  return {
    x, y,
    vx: random.range(-90, 90),
    vy: random.range(-90, 90),
    life: random.range(0.25, 0.6),
    maxLife: 0.6,
    kind, // spark | smoke | cash | flash | blood
    size: kind === 'smoke' ? random.range(8, 16) : random.range(2, 5),
  };
}

export function burst(particles, x, y, kind, count, random) {
  for (let i = 0; i < count; i += 1) {
    particles.push(makeParticle(x, y, kind, random));
  }
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= (1 - 2.4 * dt);
    p.vy *= (1 - 2.4 * dt);
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// Move bullets, hit buildings, cars, enemies and the player. Returns a
// list of hit events for the game to score and announce.
export function updateBullets(bullets, state, city, dt) {
  const hits = [];
  const { enemies, player, cars } = state;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.traveled += Math.hypot(b.vx, b.vy) * dt;
    let dead = b.traveled > b.range || !city.insideWorld(b.x, b.y);
    if (!dead) {
      const probe = { x: b.x, y: b.y };
      if (city.resolveCircle(probe, 1)) {
        dead = true;
        hits.push({ type: 'wall', x: b.x, y: b.y });
      }
    }
    if (!dead && b.fromPlayer) {
      for (let j = enemies.length - 1; j >= 0; j -= 1) {
        const e = enemies[j];
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 4) {
          e.hp -= b.damage;
          e.flash = 1;
          dead = true;
          hits.push({ type: 'enemy', enemy: e, x: b.x, y: b.y, damage: b.damage });
          if (e.hp <= 0) hits.push({ type: 'enemyDown', enemy: e, x: e.x, y: e.y });
          break;
        }
      }
    }
    if (!dead && !b.fromPlayer && player && player.hp > 0) {
      const target = player.inCar ? player.inCar : player;
      const r = player.inCar ? 20 : player.radius;
      if (Math.hypot(target.x - b.x, target.y - b.y) < r + 4) {
        dead = true;
        hits.push({ type: 'player', x: b.x, y: b.y, damage: b.damage });
      }
    }
    if (!dead && b.fromPlayer) {
      for (const car of cars) {
        if (car.driver === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
          car.hp -= b.damage;
          dead = true;
          hits.push({ type: 'car', car, x: b.x, y: b.y });
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
  return hits;
}
