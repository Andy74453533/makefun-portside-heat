// Portside Heat — boot, the one loop, and every system talking to each
// other. Input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between
// screens: title, play, paused, missions, busted, wasted and complete.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, plays it forward with an
// autopilot, and sets window.__shotReady for a screenshot.

import { WORLD, PLAYER, CAR, MONEY } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { ACTION, createInput, createScriptedInput } from './input.js';
import { readSave, writeSave, clearSave, defaultSave } from './save.js';
import { makeCar, makeParkedCar, driveCar, updateTrafficCar, spawnParkedCars, spawnTraffic } from './vehicles.js';
import { makePlayer, makePedestrian, spawnPedestrians, updatePedestrian, createWanted, addWanted, updateWanted, makePoliceCar, updatePoliceCar, spawnPoliceNear } from './people.js';
import { WEAPONS, makeBullet, makeEnemy, updateEnemy, burst, updateParticles, updateBullets } from './combat.js';
import { MISSIONS, createMissionRunner, currentStep, startMission, advanceStep, completeMission, failMission, stepTarget, stepText, freshStepState } from './missions.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_MISSIONS, SCREEN_COMPLETE } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function buildGame(saveData) {
  const random = createRandom(seed);
  const city = createCity(random);
  const docks = city.shop('docks');
  // Rook arrives by boat: the story starts at the docks, a real trip
  // from Mara's office downtown.
  const player = makePlayer(docks.x, docks.y + 100);
  player.weapon = saveData.weapon;
  player.ammo.smg = saveData.weapon === 'smg' ? 240 : 0;
  player.armor = saveData.armor;
  const game = {
    random,
    city,
    player,
    cars: [],
    peds: [],
    enemies: [],
    bullets: [],
    particles: [],
    collectBags: [],
    wanted: createWanted(),
    save: saveData,
    missionRunner: createMissionRunner(),
    missionTarget: null,
    missionStartPrompt: null,
    lockObjective: false,
    objective: '',
    missionTitle: '',
    camera: { x: player.x, y: player.y },
    time: 0,
    messages: [],
    prompt: null,
    promptText: '',
    shake: 0,
    screen: SCREEN_TITLE,
    hasSave: saveData.missionsDone > 0 || saveData.cash > 150,
    MISSIONS,
    mouse: { x: 0, y: 0 },
    view: { width: window.innerWidth, height: window.innerHeight },
    bustedTimer: 0,
    crimeCooldown: 0,
    trafficRespawn: 0,
    missionFlash: 0,
  };
  game.missionRunner.completed = saveData.missionsDone;
  game.missionRunner.available = Math.min(MISSIONS.length, saveData.missionsDone + 1);
  game.cars.push(...spawnParkedCars(random, city, 16));
  game.cars.push(...spawnTraffic(random, city, 22));
  game.peds.push(...spawnPedestrians(random, city, 42));
  return game;
}

function pushMessage(game, text, color = '#fff') {
  game.messages.push({ text, at: game.time, color });
  if (game.messages.length > 6) game.messages.shift();
  status.textContent = text;
}

function setObjective(game) {
  // A staged screenshot scene sets its own objective and keeps it.
  if (game.lockObjective) return;
  const runner = game.missionRunner;
  if (runner.activeIndex >= 0) {
    const mission = MISSIONS[runner.activeIndex];
    const step = currentStep(runner);
    game.objective = step ? stepText(step, runner) : '';
    game.missionTitle = `Mission ${runner.activeIndex + 1} — ${mission.title}`;
    game.missionTarget = step ? stepTarget(step, game.city, game) : null;
    if (step && step.type === 'steal') {
      // Point at the nearest stealable sports car.
      let best = null;
      let bestD = Infinity;
      for (const car of game.cars) {
        if (car.kind !== 'sports' || car.driver === 'player') continue;
        const d = (car.x - game.player.x) ** 2 + (car.y - game.player.y) ** 2;
        if (d < bestD) { bestD = d; best = car; }
      }
      if (best) game.missionTarget = { x: best.x, y: best.y, label: 'Sports car' };
    }
    return;
  }
  if (runner.available < MISSIONS.length) {
    const next = MISSIONS[runner.available];
    const startShop = missionStartShop(next);
    const shop = game.city.shop(startShop);
    game.objective = `Next: ${next.title} — go to ${shop.label} (press E to start)`;
    game.missionTitle = '';
    game.missionTarget = { x: shop.x, y: shop.y, label: shop.label };
    return;
  }
  game.objective = 'Free roam — Portside is yours';
  game.missionTitle = '';
  game.missionTarget = null;
}

function missionStartShop(mission) {
  const first = mission.steps[0];
  return first.shop ?? 'mara-office';
}

function spawnStepContent(game, step) {
  const city = game.city;
  const random = game.random;
  if (step.type === 'collect') {
    const shop = city.shop(step.shop);
    game.collectBags = [];
    let tries = 0;
    while (game.collectBags.length < step.count && tries < 80) {
      tries += 1;
      const angle = random.range(0, Math.PI * 2);
      const dist = random.range(60, step.radius);
      const x = shop.x + Math.cos(angle) * dist;
      const y = shop.y + Math.sin(angle) * dist;
      if (!city.insideWorld(x, y)) continue;
      const probe = { x, y };
      if (city.resolveCircle(probe, 20)) continue;
      game.collectBags.push({ x, y });
    }
  }
  if (step.type === 'kill') {
    const shop = city.shop(step.shop);
    game.enemies = [];
    for (let i = 0; i < step.count; i += 1) {
      const angle = (i / step.count) * Math.PI * 2;
      game.enemies.push(makeEnemy(random, shop.x + Math.cos(angle) * 170, shop.y + Math.sin(angle) * 140));
    }
    game.missionRunner.stepState.spawned = true;
  }
  if (step.type === 'boss') {
    const shop = city.shop(step.shop);
    game.enemies = [];
    game.enemies.push(makeEnemy(random, shop.x, shop.y, 'boss'));
    for (let i = 0; i < 3; i += 1) {
      game.enemies.push(makeEnemy(random, shop.x + random.range(-160, 160), shop.y + random.range(-160, 160)));
    }
    game.missionRunner.stepState.spawned = true;
  }
  if (step.type === 'survive') {
    addWanted(game.wanted, step.stars, game.time);
    pushMessage(game, `Survive the heat at ${step.stars} stars!`, '#ffd94a');
  }
}

function onStepStart(game, step) {
  spawnStepContent(game, step);
}

function damagePlayer(game, amount) {
  const p = game.player;
  if (p.invulnerable > 0 || p.hp <= 0) return;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.6);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  game.shake = Math.max(game.shake, 7);
  if (p.hp <= 0) {
    p.hp = 0;
    wasted(game);
  }
}

function respawnAtHospital(game, fine, label) {
  const hospital = game.city.shop('hospital');
  game.player.x = hospital.x + 40;
  game.player.y = hospital.y + 80;
  game.player.inCar = null;
  game.player.hp = game.player.maxHp;
  game.player.armor = 0;
  game.wanted.stars = 0;
  game.wanted.heat = 0;
  game.bustedTimer = 0;
  game.cars = game.cars.filter((c) => c.driver !== 'police');
  game.enemies = [];
  game.bullets = [];
  game.save.cash = Math.max(0, game.save.cash - fine);
  if (game.missionRunner.activeIndex >= 0) {
    failMission(game.missionRunner);
    pushMessage(game, 'Mission failed.', '#ff8a7a');
  }
  pushMessage(game, label, '#ffd94a');
  writeSave(game.save);
}

function busted(game) {
  game.save.timesBusted += 1;
  audio.busted();
  respawnAtHospital(game, MONEY.BUSTED_FINE, 'Busted! Fine paid: $200.');
  game.screen = SCREEN_BUSTED;
}

function wasted(game) {
  game.save.timesWasted += 1;
  audio.busted();
  respawnAtHospital(game, MONEY.WASTED_FINE, 'Wasted! Hospital bill: $150.');
  game.screen = SCREEN_WASTED;
}

function nearestCar(game, x, y, maxDist) {
  let best = null;
  let bestD = Infinity;
  for (const car of game.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < maxDist && d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function nearestShop(game, x, y, maxDist) {
  let best = null;
  let bestD = Infinity;
  for (const shop of game.city.shops) {
    const d = Math.hypot(shop.x - x, shop.y - y);
    if (d < maxDist && d < bestD) { bestD = d; best = shop; }
  }
  return best;
}

function interact(game, input) {
  const p = game.player;
  if (!p.inCar) {
    // Enter the nearest car.
    const car = nearestCar(game, p.x, p.y, 46);
    if (car) {
      const wasParked = car.parked || car.driver === 'traffic';
      car.parked = false;
      car.driver = 'player';
      p.inCar = car;
      p.x = car.x;
      p.y = car.y;
      audio.blip(440, 0.08);
      if (wasParked) {
        game.save.carsStolen += 1;
        if (game.crimeCooldown <= 0) {
          addWanted(game.wanted, 1, game.time);
          game.crimeCooldown = 5;
          pushMessage(game, 'Car stolen! The cops noticed.', '#ff8a7a');
        }
        if (car.kind === 'police') {
          addWanted(game.wanted, 1, game.time);
          pushMessage(game, 'You stole a police cruiser!', '#ff8a7a');
        }
      }
      return;
    }
    // Use a shop.
    const shop = nearestShop(game, p.x, p.y, 90);
    if (shop) {
      useShop(game, shop);
      return;
    }
  } else {
    // Step out of the car.
    const car = p.inCar;
    const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 30, y: car.y + Math.sin(car.angle + Math.PI / 2) * 30 };
    p.x = side.x;
    p.y = side.y;
    p.inCar = null;
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    audio.blip(330, 0.08);
  }
}

function useShop(game, shop) {
  const p = game.player;
  if (shop.id === 'gunshop') {
    if (p.weapon === 'pistol') {
      if (game.save.cash >= MONEY.SMG_PRICE) {
        game.save.cash -= MONEY.SMG_PRICE;
        p.weapon = 'smg';
        p.ammo.smg = 240;
        game.save.weapon = 'smg';
        pushMessage(game, 'Bought the SMG — 240 rounds. Stay safe out there.', '#7ddc7d');
        audio.pickup();
      } else {
        pushMessage(game, `SMG costs $${MONEY.SMG_PRICE}. You have $${game.save.cash}.`, '#ffd94a');
      }
    } else if (game.save.cash >= 100) {
      game.save.cash -= 100;
      p.ammo.smg = 240;
      pushMessage(game, 'SMG ammo refilled.', '#7ddc7d');
      audio.pickup();
    } else {
      pushMessage(game, 'Ammo refill costs $100.', '#ffd94a');
    }
    writeSave(game.save);
    return;
  }
  if (shop.id === 'hospital') {
    if (p.hp < p.maxHp) {
      if (game.save.cash >= MONEY.HEALTH_PRICE) {
        game.save.cash -= MONEY.HEALTH_PRICE;
        p.hp = p.maxHp;
        pushMessage(game, 'Patched up at Portside General.', '#7ddc7d');
        audio.pickup();
      } else {
        pushMessage(game, `Treatment costs $${MONEY.HEALTH_PRICE}.`, '#ffd94a');
      }
    } else {
      pushMessage(game, 'You are already in one piece.', '#fff');
    }
    writeSave(game.save);
    return;
  }
  if (shop.id === 'garage') {
    if (p.inCar && p.inCar.hp < p.inCar.maxHp) {
      if (game.save.cash >= MONEY.REPAIR_PRICE) {
        game.save.cash -= MONEY.REPAIR_PRICE;
        p.inCar.hp = p.inCar.maxHp;
        pushMessage(game, 'Car repaired.', '#7ddc7d');
        audio.pickup();
      } else {
        pushMessage(game, `Repairs cost $${MONEY.REPAIR_PRICE}.`, '#ffd94a');
      }
    } else {
      pushMessage(game, 'The garage fixes cars. Bring one in.', '#fff');
    }
    writeSave(game.save);
    return;
  }
  pushMessage(game, `${shop.label} — nothing to do here right now.`, '#fff');
}

function checkMissionStep(game, input, dt) {
  const runner = game.missionRunner;
  if (runner.activeIndex < 0) {
    // Stand at the start marker and press E to begin the next mission.
    if (runner.available < MISSIONS.length) {
      const next = MISSIONS[runner.available];
      const shop = game.city.shop(missionStartShop(next));
      const p = game.player;
      const pos = p.inCar ?? p;
      const d = Math.hypot(pos.x - shop.x, pos.y - shop.y);
      if (d < 80) {
        game.missionStartPrompt = { x: shop.x, y: shop.y, title: next.title };
        if (input.wasPressed(ACTION.INTERACT)) {
          startMission(runner, runner.available);
          const step = currentStep(runner);
          onStepStart(game, step);
          pushMessage(game, `Mission: ${next.title}`, '#ffd94a');
          pushMessage(game, next.briefing, '#fff');
          audio.missionComplete();
          game.missionStartPrompt = null;
        }
      } else {
        game.missionStartPrompt = null;
      }
    }
    return;
  }
  const step = currentStep(runner);
  if (!step) return;
  const p = game.player;
  const pos = p.inCar ?? p;
  const s = runner.stepState;
  if (step.type === 'goto') {
    const shop = game.city.shop(step.shop);
    if (Math.hypot(pos.x - shop.x, pos.y - shop.y) < step.radius) {
      if (advanceStep(runner) === 'mission-complete') finishMission(game);
      else onStepStart(game, currentStep(runner));
    }
  } else if (step.type === 'steal') {
    if (p.inCar && p.inCar.kind === 'sports') {
      pushMessage(game, 'Nice wheels. Now deliver it.', '#7ddc7d');
      if (advanceStep(runner) === 'mission-complete') finishMission(game);
      else onStepStart(game, currentStep(runner));
    }
  } else if (step.type === 'deliver') {
    const shop = game.city.shop(step.shop);
    if (p.inCar && Math.hypot(p.inCar.x - shop.x, p.inCar.y - shop.y) < step.radius) {
      pushMessage(game, 'Delivered. Mara is pleased.', '#7ddc7d');
      if (advanceStep(runner) === 'mission-complete') finishMission(game);
      else onStepStart(game, currentStep(runner));
    }
  } else if (step.type === 'collect') {
    for (let i = game.collectBags.length - 1; i >= 0; i -= 1) {
      const bag = game.collectBags[i];
      if (Math.hypot(pos.x - bag.x, pos.y - bag.y) < 30) {
        game.collectBags.splice(i, 1);
        s.collected += 1;
        game.save.cash += 25;
        burst(game.particles, bag.x, bag.y, 'cash', 8, game.random);
        audio.pickup();
      }
    }
    if (s.collected >= step.count) {
      if (advanceStep(runner) === 'mission-complete') finishMission(game);
      else onStepStart(game, currentStep(runner));
    }
  } else if (step.type === 'kill') {
    if (s.killed >= step.count) {
      if (advanceStep(runner) === 'mission-complete') finishMission(game);
      else onStepStart(game, currentStep(runner));
    }
  } else if (step.type === 'escape') {
    if (!s.pickedUp) {
      const shop = game.city.shop(step.shop);
      if (Math.hypot(pos.x - shop.x, pos.y - shop.y) < step.radius) {
        s.pickedUp = true;
        addWanted(game.wanted, 2, game.time);
        pushMessage(game, "Mara's in! Lose the cops, then get to the safehouse.", '#ffd94a');
      }
    } else if (game.wanted.stars === 0) {
      const safe = game.city.shop('safehouse');
      if (Math.hypot(pos.x - safe.x, pos.y - safe.y) < step.radius) {
        if (advanceStep(runner) === 'mission-complete') finishMission(game);
        else onStepStart(game, currentStep(runner));
      }
    }
  } else if (step.type === 'survive') {
    game.wanted.stars = Math.max(game.wanted.stars, step.stars);
    s.elapsed += dt;
    if (s.elapsed >= step.seconds) {
      pushMessage(game, 'You survived the heat. Now finish Rico.', '#7ddc7d');
      if (advanceStep(runner) === 'mission-complete') finishMission(game);
      else onStepStart(game, currentStep(runner));
    }
  } else if (step.type === 'boss') {
    const boss = game.enemies.find((e) => e.kind === 'boss');
    if (!boss) {
      if (advanceStep(runner) === 'mission-complete') finishMission(game);
      else onStepStart(game, currentStep(runner));
    }
  }
}

function finishMission(game) {
  const mission = completeMission(game.missionRunner);
  game.save.cash += mission.reward;
  game.save.missionsDone = game.missionRunner.completed;
  pushMessage(game, `Mission complete: ${mission.title} — +$${mission.reward}`, '#7ddc7d');
  audio.missionComplete();
  writeSave(game.save);
  if (game.missionRunner.done) {
    game.screen = SCREEN_COMPLETE;
  }
}

function stepGame(game, input, dt) {
  game.time += dt;
  game.crimeCooldown = Math.max(0, game.crimeCooldown - dt);
  game.shake = Math.max(0, game.shake - dt * 26);
  const p = game.player;
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.flash = Math.max(0, (p.flash ?? 0) - dt * 6);

  // Aim: the mouse in world space.
  const view = game.view;
  const aimWorldX = game.camera.x + (input.mouse.x - view.width / 2);
  const aimWorldY = game.camera.y + (input.mouse.y - view.height / 2);
  if (!p.inCar) {
    p.aimAngle = Math.atan2(aimWorldY - p.y, aimWorldX - p.x);
  }

  // Movement.
  const axis = input.axis();
  if (p.inCar) {
    const car = p.inCar;
    driveCar(car, {
      throttle: axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0,
      steer: axis.x,
      brake: input.isDown(ACTION.BRAKE),
    }, dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    const before = { x: car.x, y: car.y };
    if (game.city.resolveCircle(car, 20)) {
      if (Math.abs(car.speed) > 220) {
        car.hp -= Math.round((Math.abs(car.speed) - 220) / 14);
        burst(game.particles, car.x, car.y, 'spark', 10, game.random);
        game.shake = Math.max(game.shake, 5);
        audio.noise(0.15, 0.15, 700);
      }
      car.speed *= 0.55;
    }
    if (car.hp <= 0) {
      burst(game.particles, car.x, car.y, 'flash', 26, game.random);
      burst(game.particles, car.x, car.y, 'smoke', 16, game.random);
      game.shake = 14;
      audio.noise(0.5, 0.4, 500);
      p.inCar = null;
      p.x = before.x + 40;
      p.y = before.y;
      damagePlayer(game, 25);
      game.cars.splice(game.cars.indexOf(car), 1);
      pushMessage(game, 'Your car is wrecked!', '#ff8a7a');
    }
  } else {
    const speed = input.isDown(ACTION.SPRINT) ? PLAYER.SPRINT_SPEED : PLAYER.WALK_SPEED;
    const len = Math.hypot(axis.x, axis.y) || 1;
    p.x += (axis.x / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
    p.y += (axis.y / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
    if (axis.x || axis.y) p.angle = Math.atan2(axis.y, axis.x);
    game.city.resolveCircle(p, p.radius);
    p.x = Math.max(20, Math.min(WORLD.SIZE - 20, p.x));
    p.y = Math.max(20, Math.min(WORLD.SIZE - 20, p.y));
  }

  // Interact.
  if (input.wasPressed(ACTION.INTERACT)) interact(game, input);

  // Shooting.
  const spec = WEAPONS[p.weapon];
  const wantShoot = spec.auto ? input.mouse.down : input.wasPressed(ACTION.SHOOT);
  if (!p.inCar && wantShoot && p.fireCooldown <= 0) {
    if (p.weapon === 'smg' && p.ammo.smg <= 0) {
      p.weapon = 'pistol';
      pushMessage(game, 'SMG is dry — back to the pistol.', '#ffd94a');
    } else {
      const aim = p.aimAngle + game.random.range(-spec.spread, spec.spread);
      game.bullets.push(makeBullet(p.x + Math.cos(aim) * 20, p.y + Math.sin(aim) * 20, aim, p.weapon, true));
      p.fireCooldown = spec.fireRate;
      p.flash = 1;
      if (p.weapon === 'smg') p.ammo.smg -= 1;
      audio.gunshot();
      if (game.crimeCooldown <= 0) {
        addWanted(game.wanted, 1, game.time);
        game.crimeCooldown = 6;
      }
    }
  }

  // Traffic and pedestrians.
  for (const car of game.cars) {
    if (car.driver === 'traffic') updateTrafficCar(car, game.city, dt, game.random);
  }
  for (const ped of game.peds) {
    const danger = game.player.inCar && Math.abs(game.player.inCar.speed) > 240
      ? game.player.inCar : null;
    updatePedestrian(ped, game.city, dt, game.random, danger);
    // A speeding car knocks a pedestrian down.
    if (p.inCar && Math.hypot(ped.x - p.x, ped.y - p.y) < 26 && Math.abs(p.inCar.speed) > 120 && ped.state !== 'down') {
      ped.state = 'down';
      ped.downTimer = 3;
      burst(game.particles, ped.x, ped.y, 'smoke', 6, game.random);
      if (game.crimeCooldown <= 0) {
        addWanted(game.wanted, 1, game.time);
        game.crimeCooldown = 5;
        pushMessage(game, 'You hit a pedestrian!', '#ff8a7a');
      }
    }
  }

  // Car-to-car collisions: push apart, dent both.
  const cars = game.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 40 && d > 0.01) {
        const push = (40 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 260) {
          a.hp -= 4;
          b.hp -= 4;
          burst(game.particles, (a.x + b.x) / 2, (a.y + b.y) / 2, 'spark', 6, game.random);
        }
      }
    }
  }
  // Wrecked traffic cars burn out and leave.
  for (let i = cars.length - 1; i >= 0; i -= 1) {
    const car = cars[i];
    if (car.driver !== 'player' && car.hp <= 0) {
      burst(game.particles, car.x, car.y, 'smoke', 14, game.random);
      cars.splice(i, 1);
      game.trafficRespawn = 4;
    }
  }
  game.trafficRespawn -= dt;
  if (game.trafficRespawn <= 0 && cars.filter((c) => c.driver === 'traffic').length < 20) {
    cars.push(...spawnTraffic(game.random, game.city, 2));
    game.trafficRespawn = 6;
  }

  // Enemies.
  const playerPos = p.inCar ? { x: p.inCar.x, y: p.inCar.y } : p;
  for (const e of game.enemies) {
    updateEnemy(e, p, playerPos, game.city, dt, game.random, game.bullets);
  }

  // Bullets and their consequences.
  const hits = updateBullets(game.bullets, { enemies: game.enemies, player: p, cars: game.cars }, game.city, dt);
  for (const hit of hits) {
    if (hit.type === 'wall') burst(game.particles, hit.x, hit.y, 'spark', 4, game.random);
    if (hit.type === 'enemy') burst(game.particles, hit.x, hit.y, 'flash', 5, game.random);
    if (hit.type === 'enemyDown') {
      const e = hit.enemy;
      burst(game.particles, e.x, e.y, 'smoke', 10, game.random);
      game.save.kills += 1;
      game.save.cash += 25;
      if (p.weapon === 'smg') p.ammo.smg += 24;
      pushMessage(game, `${e.name} is down. +$25`, '#7ddc7d');
      audio.blip(520, 0.1);
      const runner = game.missionRunner;
      if (runner.activeIndex >= 0 && currentStep(runner)?.type === 'kill') {
        runner.stepState.killed += 1;
      }
      game.enemies.splice(game.enemies.indexOf(e), 1);
    }
    if (hit.type === 'player') {
      damagePlayer(game, hit.damage);
      audio.blip(140, 0.15, 'square', 0.1);
    }
    if (hit.type === 'car') {
      burst(game.particles, hit.x, hit.y, 'spark', 5, game.random);
    }
  }

  updateParticles(game.particles, dt);

  // Wanted level and police.
  const policeCars = game.cars.filter((c) => c.driver === 'police');
  const policeNear = policeCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 520);
  const surviving = game.missionRunner.activeIndex >= 0 && currentStep(game.missionRunner)?.type === 'survive';
  if (!surviving) updateWanted(game.wanted, dt, game.time, policeNear);
  if (game.wanted.stars > 0) game.save.bestWanted = Math.max(game.save.bestWanted, game.wanted.stars);
  const wantCount = game.wanted.stars > 0 ? [0, 2, 3, 5, 7, 9][game.wanted.stars] : 0;
  if (policeCars.length < wantCount) {
    const cop = spawnPoliceNear(game.random, game.city, p, game.cars);
    game.cars.push(cop);
  } else if (policeCars.length > wantCount) {
    // The furthest cruisers give up first.
    policeCars.sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y));
    const extra = policeCars[0];
    game.cars.splice(game.cars.indexOf(extra), 1);
  }
  for (const cop of game.cars.filter((c) => c.driver === 'police')) {
    updatePoliceCar(cop, playerPos, game.city, dt);
    cop.ramCooldown = Math.max(0, (cop.ramCooldown ?? 0) - dt);
    // Ramming the player's car dents it in bumps, not a steady drain.
    if (p.inCar) {
      if (Math.hypot(cop.x - p.inCar.x, cop.y - p.inCar.y) < 44 && cop.ramCooldown <= 0) {
        cop.ramCooldown = 0.7;
        p.inCar.hp -= 6;
        game.shake = Math.max(game.shake, 3);
        burst(game.particles, cop.x, cop.y, 'spark', 4, game.random);
      }
    } else if (Math.hypot(cop.x - p.x, cop.y - p.y) < 40) {
      game.bustedTimer += dt;
      if (game.bustedTimer > 1.2) busted(game);
    } else {
      game.bustedTimer = Math.max(0, game.bustedTimer - dt * 2);
    }
  }
  if (p.inCar && p.inCar.hp <= 0 && game.wanted.stars > 0) {
    // The car dies under pursuit: the player is caught.
    busted(game);
  }
  // A wrecked player car explodes wherever it dies, not only on a wall.
  if (p.inCar && p.inCar.hp <= 0) {
    const wreck = p.inCar;
    burst(game.particles, wreck.x, wreck.y, 'flash', 26, game.random);
    burst(game.particles, wreck.x, wreck.y, 'smoke', 16, game.random);
    game.shake = 14;
    audio.noise(0.5, 0.4, 500);
    p.inCar = null;
    p.x = wreck.x + 40;
    p.y = wreck.y;
    damagePlayer(game, 25);
    game.cars.splice(game.cars.indexOf(wreck), 1);
    pushMessage(game, 'Your car is wrecked!', '#ff8a7a');
  }

  // Missions.
  checkMissionStep(game, input, dt);
  setObjective(game);

  // Interaction prompt.
  game.prompt = null;
  game.promptText = '';
  if (game.missionStartPrompt) {
    game.prompt = { x: game.missionStartPrompt.x, y: game.missionStartPrompt.y };
    game.promptText = `E — Start mission: ${game.missionStartPrompt.title}`;
  }
  if (!p.inCar) {
    const car = nearestCar(game, p.x, p.y, 46);
    if (car) {
      game.prompt = { x: car.x, y: car.y };
      game.promptText = car.driver === 'police' ? 'E — Steal police cruiser' : car.parked ? 'E — Steal car' : 'E — Enter car';
    } else {
      const shop = nearestShop(game, p.x, p.y, 90);
      if (shop) {
        game.prompt = { x: shop.x, y: shop.y };
        game.promptText = shop.id === 'gunshop' ? 'E — Ironworks Guns (SMG $800)' : shop.id === 'hospital' ? 'E — Portside General (heal $100)' : shop.id === 'garage' ? 'E — Garage (repair $50)' : `E — ${shop.label}`;
      }
    }
  } else {
    game.promptText = 'E — Get out';
  }

  // Camera follows the player, clamped to the world.
  const target = p.inCar ? p.inCar : p;
  const vw = game.view.width;
  const vh = game.view.height;
  game.camera.x += (target.x - game.camera.x) * Math.min(1, 5 * dt);
  game.camera.y += (target.y - game.camera.y) * Math.min(1, 5 * dt);
  game.camera.x = Math.max(vw / 2 - 60, Math.min(WORLD.SIZE - vw / 2 + 60, game.camera.x));
  game.camera.y = Math.max(vh / 2 - 60, Math.min(WORLD.SIZE - vh / 2 + 60, game.camera.y));

  // Audio follows the action.
  audio.setEngine(p.inCar ? Math.abs(p.inCar.speed) / 560 : 0, !!p.inCar);
  audio.setSiren(policeCars.length > 0, dt);
  audio.music(dt);
  game.save.playSeconds += dt;
}

function runShotMode(game) {
  const scene = stageShot(shot, game);
  const input = createScriptedInput();
  let elapsed = 0;
  function frame() {
    const dt = STEP;
    scene.autopilot(game, input, dt);
    // The camera is fixed for the shot's composed frame.
    stepGame(game, input, dt);
    input.endFrame();
    game.mouse.x = input.mouse.x;
    game.mouse.y = input.mouse.y;
    elapsed += dt;
    if (elapsed < scene.seconds) {
      requestAnimationFrame(frame);
    } else {
      game.view.width = canvas.clientWidth;
      game.view.height = canvas.clientHeight;
      renderer.draw(game);
      renderer.draw(game);
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(frame);
}

function runGame() {
  const saveData = readSave();
  const game = buildGame(saveData);
  const input = createInput(canvas);
  let last = performance.now();
  let accumulator = 0;

  function startAudioOnce() {
    audio.start();
  }
  window.addEventListener('keydown', startAudioOnce, { once: true });
  window.addEventListener('mousedown', startAudioOnce, { once: true });

  function draw() {
    // Screen shake: jitter the camera for this frame only.
    const ox = game.camera.x;
    const oy = game.camera.y;
    if (game.shake > 0.5) {
      game.camera.x += (Math.random() - 0.5) * game.shake;
      game.camera.y += (Math.random() - 0.5) * game.shake;
    }
    game.view.width = canvas.clientWidth;
    game.view.height = canvas.clientHeight;
    game.mouse.x = input.mouse.x;
    game.mouse.y = input.mouse.y;
    renderer.draw(game);
    game.camera.x = ox;
    game.camera.y = oy;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    const screen = game.screen;

    if (screen === SCREEN_TITLE) {
      // The city idles behind the menu: traffic rolls, peds stroll.
      accumulator += dt;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        for (const car of game.cars) {
          if (car.driver === 'traffic') updateTrafficCar(car, game.city, STEP, game.random);
        }
        for (const ped of game.peds) updatePedestrian(ped, game.city, STEP, game.random, null);
        game.time += STEP;
      }
      if (input.wasPressed(ACTION.UP) || input.wasPressed(ACTION.INTERACT) || input.mouse.pressed) {
        // Any key or click starts; ENTER is the advertised way in.
        game.screen = SCREEN_PLAY;
        pushMessage(game, 'Welcome to Portside, Rook.', '#ffd94a');
        setObjective(game);
      }
      if (input.wasPressed(ACTION.RELOAD)) {
        clearSave();
        game.save = defaultSave();
        game.hasSave = false;
        pushMessage(game, 'Fresh start — the slate is clean.', '#fff');
      }
      draw();
      input.endFrame();
      return;
    }

    if (screen === SCREEN_PAUSED || screen === SCREEN_MISSIONS) {
      if (input.wasPressed(ACTION.PAUSE)) game.screen = SCREEN_PLAY;
      if (screen === SCREEN_MISSIONS && input.wasPressed(ACTION.MISSIONS)) game.screen = SCREEN_PLAY;
      if (input.wasPressed(ACTION.MISSIONS) && screen === SCREEN_PAUSED) game.screen = SCREEN_MISSIONS;
      if (input.wasPressed(ACTION.RELOAD) && screen === SCREEN_PAUSED) {
        // Restart the current mission.
        if (game.missionRunner.activeIndex >= 0) {
          failMission(game.missionRunner);
          pushMessage(game, 'Mission restarted.', '#fff');
        }
      }
      draw();
      input.endFrame();
      return;
    }

    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_COMPLETE) {
      if (input.wasPressed(ACTION.INTERACT) || input.wasPressed(ACTION.UP) || input.mouse.pressed) {
        game.screen = SCREEN_PLAY;
        pushMessage(game, 'Back on the street.', '#fff');
      }
      draw();
      input.endFrame();
      return;
    }

    // Playing.
    if (input.wasPressed(ACTION.PAUSE)) {
      game.screen = SCREEN_PAUSED;
      draw();
      input.endFrame();
      return;
    }
    if (input.wasPressed(ACTION.MISSIONS)) {
      game.screen = SCREEN_MISSIONS;
      draw();
      input.endFrame();
      return;
    }

    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      accumulator -= STEP;
      steps += 1;
      stepGame(game, input, STEP);
      if (game.screen !== SCREEN_PLAY) break;
    }
    if (steps === 5) accumulator = 0;
    draw();
    input.endFrame();
  }

  requestAnimationFrame(frame);
}

if (shot) {
  // Screenshot mode: no save, no audio, a fixed seed, staged scenes.
  const game = buildGame(defaultSave());
  game.hasSave = false;
  runShotMode(game);
} else {
  runGame();
}
