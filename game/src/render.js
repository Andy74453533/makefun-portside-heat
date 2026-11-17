// Everything the player sees: the city from above, the cars and people in
// it, the effects of a shootout, and the HUD with its minimap. One canvas,
// drawn in layers — ground, roads, props, buildings, entities, effects,
// then the interface on top.

import { WORLD, COLORS, CAR } from './config.js';

const TAU = Math.PI * 2;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_MISSIONS = 'missions';
export const SCREEN_COMPLETE = 'complete';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGround(g, cam) {
    const s = WORLD.SIZE;
    // Base grass.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(cam.x - width / 2 - 40, cam.y - height / 2 - 40, width + 80, height + 80);
    // Beach and sea along the south edge.
    const beachTop = g.city.beachTop();
    if (cam.y + height / 2 > beachTop - 80) {
      ctx.fillStyle = COLORS.sand;
      ctx.fillRect(cam.x - width / 2 - 40, beachTop, width + 80, s - beachTop);
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(cam.x - width / 2 - 40, s - 60, width + 80, 100);
      ctx.fillStyle = COLORS.waterDeep;
      ctx.fillRect(cam.x - width / 2 - 40, s - 20, width + 80, 60);
      // Animated wave lines.
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        const wy = s - 62 + i * 14 + Math.sin(g.time * 1.4 + i * 2) * 3;
        ctx.beginPath();
        ctx.moveTo(cam.x - width / 2 - 40, wy);
        ctx.lineTo(cam.x + width / 2 + 40, wy);
        ctx.stroke();
      }
    }
    // Parks.
    for (const park of g.city.parks) {
      ctx.fillStyle = COLORS.parkGreen;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const pond of g.city.ponds) {
      ctx.fillStyle = COLORS.water;
      ctx.beginPath();
      ctx.ellipse(pond.x + pond.w / 2, pond.y + pond.h / 2, pond.w / 2, pond.h / 2, 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawRoads(g) {
    const half = WORLD.ROAD_WIDTH / 2;
    // Sidewalk skirts, then asphalt.
    for (const p of g.city.roads) {
      ctx.fillStyle = COLORS.sidewalk;
      ctx.fillRect(0, p - half - 14, WORLD.SIZE, WORLD.ROAD_WIDTH + 28);
      ctx.fillRect(p - half - 14, 0, WORLD.ROAD_WIDTH + 28, WORLD.SIZE);
      ctx.fillStyle = COLORS.asphalt;
      ctx.fillRect(0, p - half, WORLD.SIZE, WORLD.ROAD_WIDTH);
      ctx.fillRect(p - half, 0, WORLD.ROAD_WIDTH, WORLD.SIZE);
    }
    // Centre dashes and edge lines.
    ctx.strokeStyle = '#e8d24a';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const p of g.city.roads) {
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(WORLD.SIZE, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, WORLD.SIZE);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (const p of g.city.roads) {
      ctx.strokeRect(p - half + 3, 0, 0, 0);
      ctx.beginPath();
      ctx.moveTo(0, p - half + 4);
      ctx.lineTo(WORLD.SIZE, p - half + 4);
      ctx.moveTo(0, p + half - 4);
      ctx.lineTo(WORLD.SIZE, p + half - 4);
      ctx.moveTo(p - half + 4, 0);
      ctx.lineTo(p - half + 4, WORLD.SIZE);
      ctx.moveTo(p + half - 4, 0);
      ctx.lineTo(p + half - 4, WORLD.SIZE);
      ctx.stroke();
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const px of g.city.roads) {
      for (const py of g.city.roads) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(px + i * 12 - 4, py - half - 10, 8, 10);
          ctx.fillRect(px + i * 12 - 4, py + half, 8, 10);
          ctx.fillRect(px - half - 10, py + i * 12 - 4, 10, 8);
          ctx.fillRect(px + half, py + i * 12 - 4, 10, 8);
        }
      }
    }
  }

  function drawProps(g) {
    // Containers.
    for (const c of g.city.containers) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      ctx.beginPath();
      ctx.moveTo(c.x + c.w / 3, c.y);
      ctx.lineTo(c.x + c.w / 3, c.y + c.h);
      ctx.moveTo(c.x + (2 * c.w) / 3, c.y);
      ctx.lineTo(c.x + (2 * c.w) / 3, c.y + c.h);
      ctx.stroke();
    }
    // Trees and palms.
    for (const t of g.city.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.8, 0, 0, TAU);
      ctx.fill();
      if (t.palm) {
        ctx.strokeStyle = '#8a6a3f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + 3, t.y - 6);
        ctx.stroke();
        ctx.fillStyle = '#4f9e4f';
      } else {
        ctx.fillStyle = '#3f7d3a';
      }
      ctx.beginPath();
      ctx.arc(t.x, t.y - 2, t.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - 2 - t.r * 0.3, t.r * 0.45, 0, TAU);
      ctx.fill();
    }
    // Street lamps.
    for (const lamp of g.city.lamps) {
      ctx.fillStyle = '#5a5a60';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 3, 0, TAU);
      ctx.fill();
    }
  }

  function drawBuildings(g) {
    for (const b of g.city.buildings) {
      // Height as a drop shadow to the south-east.
      const lift = Math.min(26, b.height * 0.45);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      rr(b.x + lift * 0.5, b.y + lift * 0.7, b.w, b.h, 4);
      ctx.fill();
      // Walls (the side the sun does not hit) and roof.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 4, b.y + b.h - 6, b.w, 6);
      ctx.fillStyle = b.color;
      rr(b.x, b.y, b.w, b.h, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      rr(b.x, b.y, b.w, b.h, 3);
      ctx.stroke();
      // Rooftop detail: vents and, on towers, window grids.
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      const vents = b.kind === 'tower' ? 4 : 1;
      for (let i = 0; i < vents; i += 1) {
        ctx.fillRect(b.x + 12 + i * 22, b.y + 12, 12, 10);
      }
      if (b.kind === 'tower') {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        const cols = Math.floor(b.w / 26);
        const rows = Math.floor(b.h / 26);
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            if ((c + r) % 3 === 0) continue;
            ctx.fillRect(b.x + 10 + c * 26, b.y + 10 + r * 26, 12, 10);
          }
        }
      }
      if (b.kind === 'shop' || b.kind === 'office' || b.kind === 'hospital') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.label ?? '', b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
  }

  function drawCar(g, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(-CAR.LENGTH / 2 + 3, -CAR.WIDTH / 2 + 4, CAR.LENGTH, CAR.WIDTH, 8);
    ctx.fill();
    // Body.
    const body = car.kind === 'police' ? '#f2f2f2' : car.color;
    ctx.fillStyle = body;
    rr(-CAR.LENGTH / 2, -CAR.WIDTH / 2, CAR.LENGTH, CAR.WIDTH, 8);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = '#1c1c22';
      rr(-CAR.LENGTH / 2, -CAR.WIDTH / 2, 12, CAR.WIDTH, 8);
      ctx.fill();
      ctx.fillRect(-2, -CAR.WIDTH / 2, 6, CAR.WIDTH);
    }
    // Windows and roof.
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    rr(-6, -CAR.WIDTH / 2 + 3, 16, CAR.WIDTH - 6, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    rr(-2, -CAR.WIDTH / 2 + 5, 8, CAR.WIDTH - 10, 3);
    ctx.fill();
    // Headlights and taillights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(CAR.LENGTH / 2 - 2, -CAR.WIDTH / 2 + 2, 3, 4);
    ctx.fillRect(CAR.LENGTH / 2 - 2, CAR.WIDTH / 2 - 6, 3, 4);
    ctx.fillStyle = car.brakeLight ? '#ff2e2e' : '#a02020';
    ctx.fillRect(-CAR.LENGTH / 2 - 1, -CAR.WIDTH / 2 + 2, 3, 4);
    ctx.fillRect(-CAR.LENGTH / 2 - 1, CAR.WIDTH / 2 - 6, 3, 4);
    // Police light bar, flashing.
    if (car.kind === 'police') {
      const phase = Math.floor(g.time * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2020' : '#2050ff';
      ctx.fillRect(-4, -CAR.WIDTH / 2 + 1, 8, 7);
      ctx.fillStyle = phase ? '#2050ff' : '#ff2020';
      ctx.fillRect(-4, CAR.WIDTH / 2 - 8, 8, 7);
      ctx.fillStyle = phase ? 'rgba(255,32,32,0.25)' : 'rgba(32,80,255,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, TAU);
      ctx.fill();
    }
    // Damage smoke.
    if (car.hp < 45) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(-CAR.LENGTH / 4 + Math.sin(g.time * 9) * 3, -4, 6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(g, x, y, angle, color, opts = {}) {
    // Shadow and body, drawn as a little top-down figure.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, 11, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, TAU);
    ctx.stroke();
    // Facing: shoulders and a head.
    const hx = x + Math.cos(angle) * 5;
    const hy = y + Math.sin(angle) * 5;
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(hx, hy, 5.5, 0, TAU);
    ctx.fill();
    if (opts.armed) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(angle) * 13, hy + Math.sin(angle) * 13);
      ctx.stroke();
    }
    if (opts.flash > 0) {
      ctx.fillStyle = `rgba(255,220,120,${opts.flash * 0.9})`;
      ctx.beginPath();
      ctx.arc(hx + Math.cos(angle) * 14, hy + Math.sin(angle) * 14, 7, 0, TAU);
      ctx.fill();
    }
    if (opts.label) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const w = ctx.measureText(opts.label).width + 10;
      rr(x - w / 2, y - 34, w, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.label, x, y - 22);
    }
    if (opts.hp != null && opts.maxHp != null && opts.hp < opts.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 14, y - 30, 28, 4);
      ctx.fillStyle = opts.hp / opts.maxHp > 0.5 ? '#4f9e4f' : '#c94f38';
      ctx.fillRect(x - 14, y - 30, 28 * (opts.hp / opts.maxHp), 4);
    }
  }

  function drawEffects(g) {
    // Bullet tracers.
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 2;
    for (const b of g.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(80,80,80,${a * 0.45})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU);
        ctx.fill();
      } else if (p.kind === 'cash') {
        ctx.fillStyle = `rgba(232,210,74,${a})`;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      } else {
        ctx.fillStyle = p.kind === 'flash' ? `rgba(255,220,120,${a})` : `rgba(255,120,60,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 1, 0, TAU);
        ctx.fill();
      }
    }
    // Cash bags waiting to be collected.
    for (const bag of g.collectBags) {
      const bob = Math.sin(g.time * 3 + bag.x) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(bag.x + 2, bag.y + 8, 10, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2e7d32';
      rr(bag.x - 9, bag.y - 8 + bob, 18, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#e8d24a';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', bag.x, bag.y + 5 + bob);
      ctx.strokeStyle = 'rgba(232,210,74,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bag.x, bag.y + bob, 18 + Math.sin(g.time * 4) * 3, 0, TAU);
      ctx.stroke();
    }
    // Mission marker: a pulsing beacon over the objective.
    const target = g.missionTarget;
    if (target) {
      const pulse = 1 + Math.sin(g.time * 4) * 0.12;
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd94a';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      const s = 13 * pulse;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      // A light column so the target reads from far away.
      const grad = ctx.createLinearGradient(0, target.y - 260, 0, target.y);
      grad.addColorStop(0, 'rgba(255,217,74,0)');
      grad.addColorStop(1, 'rgba(255,217,74,0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(target.x - 7, target.y - 260, 14, 260);
    }
    // Interaction prompt ring on the nearest car.
    if (g.prompt) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(g.prompt.x, g.prompt.y, 34, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawMinimap(g) {
    const size = 168;
    const x0 = width - size - 14;
    const y0 = 14;
    const scale = size / WORLD.SIZE;
    ctx.save();
    ctx.fillStyle = 'rgba(12,16,12,0.82)';
    rr(x0 - 4, y0 - 4, size + 8, size + 8, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    rr(x0 - 4, y0 - 4, size + 8, size + 8, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    // Ground, roads, water.
    ctx.fillStyle = '#5d7d43';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#3f8fb5';
    ctx.fillRect(x0, y0 + g.city.beachTop() * scale, size, size);
    ctx.fillStyle = '#3a3a40';
    for (const p of g.city.roads) {
      ctx.fillRect(x0, y0 + p * scale - 1.5, size, 3);
      ctx.fillRect(x0 + p * scale - 1.5, y0, 3, size);
    }
    ctx.fillStyle = '#7a8ba0';
    for (const b of g.city.buildings) {
      if (b.kind === 'tower') ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
    }
    // Shops.
    ctx.fillStyle = '#4fd06a';
    for (const shop of g.city.shops) {
      ctx.beginPath();
      ctx.arc(x0 + shop.x * scale, y0 + shop.y * scale, 2.5, 0, TAU);
      ctx.fill();
    }
    // Mission target.
    if (g.missionTarget) {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(x0 + g.missionTarget.x * scale, y0 + g.missionTarget.y * scale, 4, 0, TAU);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#3f7fff';
    for (const car of g.cars) {
      if (car.driver === 'police') {
        ctx.beginPath();
        ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 3, 0, TAU);
        ctx.fill();
      }
    }
    // Enemies.
    ctx.fillStyle = '#ff4a3d';
    for (const e of g.enemies) {
      ctx.beginPath();
      ctx.arc(x0 + e.x * scale, y0 + e.y * scale, 3, 0, TAU);
      ctx.fill();
    }
    // Player, with a white ring.
    const px = x0 + g.player.x * scale;
    const py = y0 + g.player.y * scale;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, TAU);
    ctx.stroke();
    // North marker.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', x0 + size / 2, y0 + size + 16);
    ctx.restore();
  }

  function drawStars(g) {
    const cx = width / 2;
    const y = 18;
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < g.wanted.stars ? '#ffd94a' : 'rgba(255,255,255,0.28)';
      const sx = cx + (i - 2) * 28;
      ctx.fillText('★', sx, y + 18);
    }
  }

  function drawHud(g) {
    // Top-left: cash, health, armor.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(12, 12, 210, 86, 8);
    ctx.fill();
    ctx.fillStyle = '#7ddc7d';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`$${g.save.cash.toLocaleString()}`, 24, 38);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`WEAPON  ${g.player.weapon === 'smg' ? 'SMG' : 'PISTOL'}`, 24, 58);
    if (g.player.weapon === 'smg') ctx.fillText(`AMMO  ${g.player.ammo.smg}`, 150, 58);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(24, 66, 186, 8);
    ctx.fillStyle = g.player.hp > 40 ? '#4f9e4f' : '#c94f38';
    ctx.fillRect(24, 66, 186 * (g.player.hp / g.player.maxHp), 8);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`HP ${Math.ceil(g.player.hp)}`, 24, 90);
    if (g.player.armor > 0) ctx.fillText(`ARMOR ${Math.ceil(g.player.armor)}`, 130, 90);

    drawStars(g);
    drawMinimap(g);

    // Mission objective banner.
    if (g.objective) {
      ctx.font = 'bold 15px sans-serif';
      const w = ctx.measureText(g.objective).width + 28;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      rr(width / 2 - w / 2, 44, w, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.textAlign = 'center';
      ctx.fillText(g.objective, width / 2, 64);
    }
    if (g.missionTitle) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.missionTitle, width / 2, 92);
    }

    // Bottom-left: car speed or controls hint.
    ctx.textAlign = 'left';
    if (g.player.inCar) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      rr(12, height - 58, 170, 46, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`${Math.round(Math.abs(g.player.inCar.speed) * 0.12)} mph`, 24, height - 28);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#ddd';
      ctx.fillText(`CAR HP ${Math.max(0, Math.ceil(g.player.inCar.hp))}`, 24, height - 16);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.font = '12px sans-serif';
      const hint = 'WASD move · E enter car · Click shoot · Shift sprint · M missions · P pause';
      const w = ctx.measureText(hint).width + 20;
      rr(12, height - 34, w, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#eee';
      ctx.fillText(hint, 22, height - 17);
    }

    // Interaction prompt.
    if (g.promptText) {
      ctx.font = 'bold 15px sans-serif';
      const w = ctx.measureText(g.promptText).width + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      rr(width / 2 - w / 2, height - 110, w, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(g.promptText, width / 2, height - 90);
    }

    // Message feed.
    ctx.textAlign = 'left';
    ctx.font = '14px sans-serif';
    let my = height - 140;
    for (const msg of g.messages.slice(-4)) {
      const age = g.time - msg.at;
      if (age > 5) continue;
      ctx.globalAlpha = Math.min(1, (5 - age) / 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const w = ctx.measureText(msg.text).width + 16;
      rr(12, my - 16, w, 22, 6);
      ctx.fill();
      ctx.fillStyle = msg.color || '#fff';
      ctx.fillText(msg.text, 20, my);
      ctx.globalAlpha = 1;
      my -= 26;
    }

    // Crosshair when on foot and armed.
    if (!g.player.inCar && g.screen === SCREEN_PLAY) {
      const m = g.mouse;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 9, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - 13, m.y);
      ctx.lineTo(m.x - 5, m.y);
      ctx.moveTo(m.x + 5, m.y);
      ctx.lineTo(m.x + 13, m.y);
      ctx.moveTo(m.x, m.y - 13);
      ctx.lineTo(m.x, m.y - 5);
      ctx.moveTo(m.x, m.y + 5);
      ctx.lineTo(m.x, m.y + 13);
      ctx.stroke();
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10,10,14,0.82)';
    rr(x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,74,0.5)';
    ctx.lineWidth = 2;
    rr(x, y, w, h, 12);
    ctx.stroke();
  }

  function drawTitle(g) {
    // A warm sunset wash over the city behind the menu.
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(255,150,60,0.25)');
    grad.addColorStop(0.5, 'rgba(20,20,30,0.15)');
    grad.addColorStop(1, 'rgba(20,20,30,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('PORTSIDE HEAT', width / 2, height * 0.3);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('An open-world crime story in the sun-soaked city of Portside', width / 2, height * 0.3 + 34);
    const boxW = 420;
    const boxH = g.hasSave ? 250 : 210;
    panel(width / 2 - boxW / 2, height * 0.42, boxW, boxH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(g.hasSave ? 'CONTINUE — your story waits' : 'NEW GAME', width / 2, height * 0.42 + 42);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#ddd';
    ctx.fillText('Press ENTER to play', width / 2, height * 0.42 + 78);
    ctx.fillText('WASD move/drive · E enter car · Mouse aim · Click shoot', width / 2, height * 0.42 + 112);
    ctx.fillText('Shift sprint · Space handbrake · M missions · P pause', width / 2, height * 0.42 + 138);
    if (g.hasSave) {
      ctx.fillText(`Cash $${g.save.cash.toLocaleString()} · Missions done ${g.save.missionsDone}/6`, width / 2, height * 0.42 + 172);
      ctx.fillText('Press N for a fresh start', width / 2, height * 0.42 + 200);
    } else {
      ctx.fillText('Steal cars. Outrun the cops. Become King of Portside.', width / 2, height * 0.42 + 172);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px sans-serif';
    ctx.fillText('A work of fiction. Any resemblance to real people or places is coincidence.', width / 2, height - 18);
  }

  function drawPaused(g) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, width, height);
    panel(width / 2 - 210, height / 2 - 130, 420, 260);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('PAUSED', width / 2, height / 2 - 82);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText('P / Esc — resume', width / 2, height / 2 - 40);
    ctx.fillText('M — mission list', width / 2, height / 2 - 12);
    ctx.fillText('R — restart mission', width / 2, height / 2 + 16);
    ctx.fillText(`Cash $${g.save.cash.toLocaleString()} · Missions ${g.save.missionsDone}/6`, width / 2, height / 2 + 52);
    ctx.fillText(`Kills ${g.save.kills} · Cars stolen ${g.save.carsStolen}`, width / 2, height / 2 + 80);
  }

  function drawMissions(g) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
    panel(width / 2 - 300, 60, 600, height - 140);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('MISSIONS', width / 2, 108);
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    const { MISSIONS } = g;
    MISSIONS.forEach((m, i) => {
      const y = 140 + i * 74;
      const done = i < g.save.missionsDone;
      const available = i === g.save.missionsDone;
      ctx.fillStyle = done ? 'rgba(79,158,79,0.25)' : available ? 'rgba(255,217,74,0.2)' : 'rgba(255,255,255,0.06)';
      rr(width / 2 - 270, y, 540, 62, 8);
      ctx.fill();
      ctx.fillStyle = done ? '#7ddc7d' : available ? '#ffd94a' : '#999';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${done ? '✓ ' : ''}${i + 1}. ${m.title} — $${m.reward}`, width / 2 - 255, y + 24);
      ctx.fillStyle = '#ddd';
      ctx.font = '13px sans-serif';
      ctx.fillText(m.briefing.slice(0, 78), width / 2 - 255, y + 46);
    });
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Walk into the yellow marker to start the next mission. M / Esc to close.', width / 2, height - 100);
  }

  function drawBusted(g) {
    ctx.fillStyle = 'rgba(10,10,40,0.72)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7fb5ff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('BUSTED!', width / 2, height / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('The Portside PD caught up with you. Fine paid: $200.', width / 2, height / 2 + 16);
    ctx.fillText('Press ENTER to get back on the street.', width / 2, height / 2 + 46);
  }

  function drawWasted(g) {
    ctx.fillStyle = 'rgba(40,5,5,0.72)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('WASTED', width / 2, height / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('You got taken down. Hospital bill: $150.', width / 2, height / 2 + 16);
    ctx.fillText('Press ENTER to get back on the street.', width / 2, height / 2 + 46);
  }

  function drawComplete(g) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('KING OF PORTSIDE', width / 2, height / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '19px sans-serif';
    ctx.fillText('Rico Vane is finished. The city is yours, Rook.', width / 2, height / 2 + 2);
    ctx.font = '15px sans-serif';
    ctx.fillText(`Cash $${g.save.cash.toLocaleString()} · Kills ${g.save.kills} · Cars stolen ${g.save.carsStolen}`, width / 2, height / 2 + 36);
    ctx.fillText('Press ENTER to keep playing in free roam.', width / 2, height / 2 + 66);
  }

  function drawWorld(g) {
    const cam = g.camera;
    ctx.save();
    ctx.translate(width / 2 - cam.x, height / 2 - cam.y);
    // Only draw what the camera can see: cull by the view rectangle.
    drawGround(g, cam);
    drawRoads(g);
    drawProps(g);
    drawBuildings(g);
    // Cash bags under the cars, then cars, then people.
    for (const car of g.cars) {
      if (car.parked) drawCar(g, car);
    }
    drawEffects(g);
    for (const car of g.cars) {
      if (!car.parked) drawCar(g, car);
    }
    for (const ped of g.peds) {
      if (ped.state === 'down') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 12, 6, 0, 0, TAU);
        ctx.fill();
        continue;
      }
      drawPerson(g, ped.x, ped.y, ped.angle, ped.color, {});
    }
    for (const e of g.enemies) {
      drawPerson(g, e.x, e.y, e.angle, '#c94f38', {
        armed: true, flash: e.flash, label: e.name,
        hp: e.hp, maxHp: e.maxHp,
      });
    }
    // The player: on foot, or drawn inside the car they drive.
    const p = g.player;
    if (!p.inCar) {
      drawPerson(g, p.x, p.y, p.aimAngle, '#2e6fb5', {
        armed: p.weapon !== 'none', flash: p.flash ?? 0,
      });
    }
    ctx.restore();
  }

  return {
    resize,
    draw(g) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(0, 0, width, height);
      if (g.screen === SCREEN_TITLE) {
        drawWorld(g);
        drawTitle(g);
        return;
      }
      drawWorld(g);
      if (g.screen === SCREEN_PLAY) {
        drawHud(g);
      } else if (g.screen === SCREEN_PAUSED) {
        drawHud(g);
        drawPaused(g);
      } else if (g.screen === SCREEN_MISSIONS) {
        drawHud(g);
        drawMissions(g);
      } else if (g.screen === SCREEN_BUSTED) {
        drawBusted(g);
      } else if (g.screen === SCREEN_WASTED) {
        drawWasted(g);
      } else if (g.screen === SCREEN_COMPLETE) {
        drawHud(g);
        drawComplete(g);
      }
      // Low-health vignette.
      if (g.screen === SCREEN_PLAY && g.player.hp < 35 && g.player.hp > 0) {
        const grad = ctx.createRadialGradient(
          width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.75,
        );
        grad.addColorStop(0, 'rgba(200,0,0,0)');
        grad.addColorStop(1, `rgba(200,0,0,${0.35 * (1 - g.player.hp / 35)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    },
  };
}
