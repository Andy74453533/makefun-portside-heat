// Portside itself: a grid city of roads, blocks and districts, built once
// from a seed. Roads run every 400 px; the blocks between them hold the
// buildings, parks, containers and palms that make each district its own.
// The same seed always builds the same city.

import { WORLD, DISTRICTS, COLORS } from './config.js';

const ROAD_POSITIONS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
const HALF_ROAD = WORLD.ROAD_WIDTH / 2;

function districtOf(cx, cy) {
  if (cy <= 1 && cx <= 2) return DISTRICTS.RESIDENTIAL;
  if (cy <= 1 && cx >= 3) return DISTRICTS.DOWNTOWN;
  if (cy >= 2 && cy <= 3 && cx <= 1) return DISTRICTS.PARK;
  if (cy >= 2 && cy <= 3 && cx >= 5) return DISTRICTS.PORT;
  if (cy >= 5 && cx <= 3) return DISTRICTS.MARINA;
  if (cy >= 5) return DISTRICTS.RESIDENTIAL;
  if (cy === 4) return DISTRICTS.RESIDENTIAL;
  return DISTRICTS.RESIDENTIAL;
}

function blockBounds(cx, cy) {
  const x0 = ROAD_POSITIONS[cx] + HALF_ROAD;
  const y0 = ROAD_POSITIONS[cy] + HALF_ROAD;
  const x1 = ROAD_POSITIONS[cx + 1] - HALF_ROAD;
  const y1 = ROAD_POSITIONS[cy + 1] - HALF_ROAD;
  return { x0, y0, x1, y1 };
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const containers = [];
  const parks = [];
  const ponds = [];

  for (let cy = 0; cy < 7; cy += 1) {
    for (let cx = 0; cx < 7; cx += 1) {
      const district = districtOf(cx, cy);
      const b = blockBounds(cx, cy);
      const bw = b.x1 - b.x0;
      const bh = b.y1 - b.y0;

      if (district === DISTRICTS.PARK) {
        parks.push({ x: b.x0, y: b.y0, w: bw, h: bh });
        const count = random.int(7, 11);
        for (let i = 0; i < count; i += 1) {
          trees.push({
            x: random.range(b.x0 + 20, b.x1 - 20),
            y: random.range(b.y0 + 20, b.y1 - 20),
            r: random.range(9, 15),
          });
        }
        if (random.chance(0.6)) {
          ponds.push({
            x: b.x0 + bw * 0.3, y: b.y0 + bh * 0.3,
            w: bw * 0.4, h: bh * 0.35,
          });
        }
        continue;
      }

      if (district === DISTRICTS.PORT) {
        // Warehouses along the top, container stacks below.
        buildings.push({
          x: b.x0 + 14, y: b.y0 + 14, w: bw - 28, h: 70,
          height: 14, color: '#8a7f74', district,
          kind: 'warehouse',
        });
        const rows = random.int(2, 3);
        for (let r = 0; r < rows; r += 1) {
          const cols = random.int(3, 5);
          for (let c = 0; c < cols; c += 1) {
            containers.push({
              x: b.x0 + 16 + c * 56, y: b.y0 + 110 + r * 34,
              w: 48, h: 26,
              color: random.pick(COLORS.container),
            });
          }
        }
        continue;
      }

      if (district === DISTRICTS.DOWNTOWN) {
        // One or two towers with real height.
        const tall = random.chance(0.5);
        buildings.push({
          x: b.x0 + 30, y: b.y0 + 30, w: tall ? bw - 60 : (bw / 2 - 40), h: bh - 60,
          height: random.int(34, 58), color: random.pick(COLORS.buildingRoof),
          district, kind: 'tower',
        });
        if (!tall) {
          buildings.push({
            x: b.x0 + bw / 2 + 10, y: b.y0 + 30, w: bw / 2 - 40, h: bh - 60,
            height: random.int(22, 40), color: random.pick(COLORS.buildingRoof),
            district, kind: 'tower',
          });
        }
        trees.push({ x: b.x0 + 12, y: b.y0 + 12, r: 10 });
        trees.push({ x: b.x1 - 12, y: b.y1 - 12, r: 10 });
        continue;
      }

      if (district === DISTRICTS.MARINA) {
        // Low beach houses and palms.
        const count = random.int(2, 3);
        for (let i = 0; i < count; i += 1) {
          const w = random.range(70, 110);
          const h = random.range(56, 84);
          buildings.push({
            x: b.x0 + 18 + i * (bw / count), y: b.y0 + 24 + random.range(0, 40),
            w, h, height: 10, color: random.pick(['#e8c98a', '#d99a5b', '#f0e0c0']),
            district, kind: 'house',
          });
        }
        const palms = random.int(4, 7);
        for (let i = 0; i < palms; i += 1) {
          trees.push({
            x: random.range(b.x0 + 14, b.x1 - 14),
            y: random.range(b.y0 + 120, b.y1 - 14),
            r: random.range(8, 12), palm: true,
          });
        }
        continue;
      }

      // Residential: a few houses with gardens and trees.
      const count = random.int(3, 4);
      for (let i = 0; i < count; i += 1) {
        const cols = 2;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const w = random.range(72, 100);
        const h = random.range(60, 88);
        buildings.push({
          x: b.x0 + 20 + col * (bw / 2) + random.range(0, 18),
          y: b.y0 + 18 + row * (bh / 2) + random.range(0, 16),
          w, h, height: random.int(8, 14),
          color: random.pick(COLORS.buildingRoof),
          district, kind: 'house',
        });
      }
      const gardenTrees = random.int(2, 4);
      for (let i = 0; i < gardenTrees; i += 1) {
        trees.push({
          x: random.range(b.x0 + 14, b.x1 - 14),
          y: random.range(b.y0 + 14, b.y1 - 14),
          r: random.range(8, 13),
        });
      }
    }
  }

  // Street lamps along every road, both sides.
  for (const p of ROAD_POSITIONS) {
    for (let t = 320; t < WORLD.SIZE - 100; t += 320) {
      lamps.push({ x: p - HALF_ROAD - 6, y: t });
      lamps.push({ x: t, y: p - HALF_ROAD - 6 });
    }
  }

  // Fixed landmarks the story and the shops live at. Each is a building
  // with a purpose, placed on a known block so missions can find it.
  const landmarks = [
    { id: 'mara-office', label: "Mara's Office", district: DISTRICTS.DOWNTOWN, cx: 4, cy: 0, kind: 'office' },
    { id: 'safehouse', label: 'Safehouse', district: DISTRICTS.RESIDENTIAL, cx: 1, cy: 4, kind: 'house' },
    { id: 'garage', label: 'Garage', district: DISTRICTS.PORT, cx: 5, cy: 2, kind: 'warehouse' },
    { id: 'gunshop', label: 'Ironworks Guns', district: DISTRICTS.DOWNTOWN, cx: 3, cy: 1, kind: 'shop' },
    { id: 'hospital', label: 'Portside General', district: DISTRICTS.RESIDENTIAL, cx: 2, cy: 4, kind: 'hospital' },
    { id: 'docks', label: 'The Docks', district: DISTRICTS.MARINA, cx: 1, cy: 5, kind: 'pier' },
    { id: 'marina', label: 'Marina', district: DISTRICTS.MARINA, cx: 2, cy: 6, kind: 'pier' },
  ];
  const shops = [];
  for (const mark of landmarks) {
    const b = blockBounds(mark.cx, mark.cy);
    const spot = {
      id: mark.id,
      label: mark.label,
      kind: mark.kind,
      x: b.x0 + (b.x1 - b.x0) / 2,
      y: b.y0 + (b.y1 - b.y0) / 2,
    };
    shops.push(spot);
  }

  const city = {
    buildings,
    trees,
    lamps,
    containers,
    parks,
    ponds,
    shops,
    roads: ROAD_POSITIONS,
    districtOf,
    blockBounds,
    shop(id) {
      return shops.find((s) => s.id === id);
    },
    isRoad(x, y) {
      for (const p of ROAD_POSITIONS) {
        if (Math.abs(x - p) <= HALF_ROAD || Math.abs(y - p) <= HALF_ROAD) return true;
      }
      return false;
    },
    // The closest point on any road centreline to (x, y).
    nearestRoadPoint(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const p of ROAD_POSITIONS) {
        const candidates = [
          { x: p, y },
          { x, y: p },
        ];
        for (const c of candidates) {
          const d = (c.x - x) ** 2 + (c.y - y) ** 2;
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      return best;
    },
    onRoadAxis(x, y) {
      // True when the point is on a vertical road (drive along y) or a
      // horizontal one (drive along x); used by traffic steering.
      let vertical = Infinity;
      let horizontal = Infinity;
      for (const p of ROAD_POSITIONS) {
        vertical = Math.min(vertical, Math.abs(x - p));
        horizontal = Math.min(horizontal, Math.abs(y - p));
      }
      return vertical < horizontal ? 'vertical' : 'horizontal';
    },
    // Push a circle out of every building and container it overlaps.
    // Returns true when anything was hit.
    resolveCircle(pos, radius) {
      let hit = false;
      const solids = buildings.concat(containers);
      for (const s of solids) {
        const nx = Math.max(s.x, Math.min(pos.x, s.x + s.w));
        const ny = Math.max(s.y, Math.min(pos.y, s.y + s.h));
        const dx = pos.x - nx;
        const dy = pos.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < radius * radius) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * radius;
            pos.y = ny + (dy / d) * radius;
          } else {
            pos.y = s.y - radius;
          }
        }
      }
      return hit;
    },
    insideWorld(x, y) {
      return x >= 20 && y >= 20 && x <= WORLD.SIZE - 20 && y <= WORLD.SIZE - 20;
    },
    // The beach and the sea along the south edge.
    beachTop() {
      return 3050;
    },
  };
  return city;
}
