// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// stages a real situation — the title screen over the city, a drive through
// downtown, a three-star police chase, a marina shootout — then plays the
// real rules forward with a simple autopilot, so the frame is what a short
// stretch of the game really looks like, and the same seed always gives
// the same frame.

import { ACTION } from './input.js';
import { makeCar, spawnTraffic } from './vehicles.js';
import { makePoliceCar, addWanted } from './people.js';
import { makeEnemy } from './combat.js';
import { startMission } from './missions.js';

function placePlayerInCar(game, x, y, angle, sports) {
  const car = makeCar(game.random, {
    x, y, angle,
    color: sports ? '#e83f2e' : '#3f7fb5',
    kind: sports ? 'sports' : 'sedan',
    driver: 'player',
  });
  game.cars.push(car);
  game.player.x = x;
  game.player.y = y;
  game.player.inCar = car;
  game.player.angle = angle;
  game.camera.x = x;
  game.camera.y = y;
  return car;
}

function driveToward(game, input, targetX, targetY) {
  // Road-following autopilot: pick a lookahead point on the road grid and
  // steer at it, so the car stays on the asphalt instead of cutting
  // through blocks. Turns happen at the next intersection ahead in the
  // direction of travel, never at the road line behind the car.
  const car = game.player.inCar;
  if (!car) return;
  const roads = game.city.roads;
  let nearestH = roads[0];
  let dh = Infinity;
  let nearestV = roads[0];
  let dv = Infinity;
  for (const p of roads) {
    if (Math.abs(car.y - p) < dh) { dh = Math.abs(car.y - p); nearestH = p; }
    if (Math.abs(car.x - p) < dv) { dv = Math.abs(car.x - p); nearestV = p; }
  }
  const onH = dh < 44;
  const onV = dv < 44;
  const LOOK = 230;
  const nextRoad = (pos, dir) => {
    let best = null;
    for (const p of roads) {
      if (dir > 0 && p > pos + 60 && (best === null || p < best)) best = p;
      if (dir < 0 && p < pos - 60 && (best === null || p > best)) best = p;
    }
    return best ?? (dir > 0 ? roads[roads.length - 1] : roads[0]);
  };
  let lookX;
  let lookY;
  if (onH && onV) {
    // At an intersection: take the axis with the bigger remaining gap.
    if (Math.abs(targetX - car.x) > Math.abs(targetY - car.y)) {
      lookX = car.x + (targetX > car.x ? LOOK : -LOOK);
      lookY = nearestH;
    } else {
      lookX = nearestV;
      lookY = car.y + (targetY > car.y ? LOOK : -LOOK);
    }
  } else if (onH) {
    const dir = Math.cos(car.angle) >= 0 ? 1 : -1;
    if (Math.abs(targetX - car.x) < 170) {
      // Aim at the intersection point itself, not diagonally at the
      // target road: cutting the corner would clip the block's building.
      lookX = nextRoad(car.x, dir);
      lookY = nearestH;
    } else {
      lookX = car.x + (targetX > car.x ? LOOK : -LOOK);
      lookY = nearestH;
    }
  } else if (onV) {
    const dir = Math.sin(car.angle) >= 0 ? 1 : -1;
    if (Math.abs(targetY - car.y) < 170) {
      lookX = nearestV;
      lookY = nextRoad(car.y, dir);
    } else {
      lookX = nearestV;
      lookY = car.y + (targetY > car.y ? LOOK : -LOOK);
    }
  } else {
    // Off the road (a shunt pushed us out): head for the nearest road.
    if (dh < dv) { lookX = car.x; lookY = nearestH; }
    else { lookX = nearestV; lookY = car.y; }
  }
  const desired = Math.atan2(lookY - car.y, lookX - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Brake into sharp turns: a 90-degree swing at full speed overshoots
  // the intersection and clips the corner building. At low speed the
  // turn radius is tight enough to stay on the asphalt.
  const sharp = Math.abs(diff) > 0.45;
  input.set(ACTION.UP, !sharp);
  input.set(ACTION.BRAKE, sharp);
  input.set(ACTION.LEFT, diff < -0.06);
  input.set(ACTION.RIGHT, diff > 0.06);
}

function aimAtNearestEnemy(game, input) {
  const p = game.player;
  if (game.enemies.length === 0) return;
  let best = null;
  let bestD = Infinity;
  for (const e of game.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  if (!best) return;
  const cam = game.camera;
  const sx = (best.x - cam.x) + game.view.width / 2;
  const sy = (best.y - cam.y) + game.view.height / 2;
  input.setMouse(sx, sy, true);
  // Strafe sideways while shooting.
  const strafe = Math.sin(game.time * 1.6) > 0 ? ACTION.LEFT : ACTION.RIGHT;
  input.set(strafe, true);
  input.set(ACTION.UP, false);
}

function downtownDrive(game) {
  // A sports car on a downtown avenue, traffic around it, peds on the
  // sidewalks, and Mara's garage marker waiting across town. The shot is
  // a straight eastbound run down the avenue, so the car holds its speed
  // and stays on the asphalt for the whole take.
  const car = placePlayerInCar(game, 1100, 1000, 0, true);
  car.speed = 300;
  car.hp = 150;
  car.maxHp = 150;
  const traffic = spawnTraffic(game.random, game.city, 12);
  game.cars.push(...traffic);
  game.objective = 'Deliver the sports car to the Garage in the port';
  game.missionTitle = 'Mission 2 — Hot Wheels';
  game.missionTarget = { x: 2400, y: 1400, label: 'Garage' };
  game.lockObjective = true;
  game.wanted.stars = 0;
  game.screen = 'play';
  return {
    seconds: 2.5,
    autopilot(g, input) {
      driveToward(g, input, 2800, 1000);
    },
  };
}

function policeChase(game) {
  // Three stars, four cruisers in pursuit, sirens on: a straight
  // southbound run down one long avenue, the cruisers closing from
  // behind, so the frame is a chase at speed, not a pile-up.
  const car = placePlayerInCar(game, 1800, 500, Math.PI / 2, true);
  car.speed = 480;
  car.hp = 150;
  car.maxHp = 150;
  addWanted(game.wanted, 3, game.time);
  // Two cruisers closing from behind, two more coming at the player
  // head-on down the same avenue, so the frame shows the chase.
  const behind = [
    makePoliceCar(game.random, 1775, 500 - 330),
    makePoliceCar(game.random, 1825, 500 - 430),
  ];
  const ahead = [
    makePoliceCar(game.random, 1780, 500 + 880),
    makePoliceCar(game.random, 1820, 500 + 1020),
  ];
  game.cars.push(...behind, ...ahead);
  const traffic = spawnTraffic(game.random, game.city, 5);
  game.cars.push(...traffic);
  game.objective = 'Lose the heat — outrun the Portside PD';
  game.missionTitle = 'WANTED ★★★';
  game.missionTarget = { x: 1800, y: 2800, label: 'Safehouse' };
  game.lockObjective = true;
  game.screen = 'play';
  return {
    seconds: 3,
    autopilot(g, input) {
      driveToward(g, input, 1800, 2800);
    },
  };
}

function marinaShootout(game) {
  // Mission 4 on foot at the marina: five Vipers, muzzle flashes, and the
  // objective banner over the fight.
  const marina = game.city.shop('marina');
  game.player.x = marina.x - 120;
  game.player.y = marina.y + 60;
  game.player.inCar = null;
  game.player.weapon = 'smg';
  game.player.ammo.smg = 240;
  game.player.armor = 100;
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  startMission(game.missionRunner, 3);
  const runner = game.missionRunner;
  runner.stepState.spawned = true;
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    game.enemies.push(makeEnemy(game.random, marina.x + Math.cos(angle) * 230, marina.y + Math.sin(angle) * 190));
  }
  addWanted(game.wanted, 1, game.time);
  game.objective = 'Take out the Vipers at the marina (0/5)';
  game.missionTitle = 'Mission 4 — Payback';
  game.missionTarget = { x: marina.x, y: marina.y, label: 'Marina' };
  game.lockObjective = true;
  game.screen = 'play';
  return {
    seconds: 3.5,
    autopilot(g, input) {
      aimAtNearestEnemy(g, input);
    },
  };
}

function titleShot(game) {
  // The title screen over downtown at golden hour: traffic rolling past
  // the towers while the menu waits.
  game.player.x = 1800;
  game.player.y = 1400;
  game.camera.x = 1800;
  game.camera.y = 1400;
  const traffic = spawnTraffic(game.random, game.city, 14);
  game.cars.push(...traffic);
  game.screen = 'title';
  return {
    seconds: 2,
    autopilot() {},
  };
}

export function stageShot(name, game) {
  // Clear any parked cars from the free-roam setup; each scene stages its own.
  game.cars = game.cars.filter((c) => !c.parked);
  game.enemies = [];
  game.bullets = [];
  game.collectBags = [];
  game.messages = [];
  if (name === 'drive') return downtownDrive(game);
  if (name === 'chase') return policeChase(game);
  if (name === 'mission') return marinaShootout(game);
  return titleShot(game);
}
