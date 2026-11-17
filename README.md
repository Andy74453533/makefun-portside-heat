[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Andy74453533/makefun-portside-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Andy74453533/makefun-portside-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [make.fun bounty: Make GTA 6](https://make.fun/bounty/gta6-01).

# Portside Heat

An open-world crime game set in Portside, a sun-soaked coastal city. Explore on foot or by car, steal vehicles, outrun the police, take on six story missions, and climb from fresh arrival to King of Portside.

## Play

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and play in a desktop browser with keyboard and mouse.

- **WASD / arrows** — move on foot or drive
- **E** — enter / exit a car, steal a parked car, interact
- **Mouse + click** — aim and shoot
- **Shift** — sprint on foot
- **Space** — handbrake
- **M** — mission list, **P / Esc** — pause

## Features

- A living city: downtown towers, a marina beach, an industrial port, and residential streets, with traffic and pedestrians
- Cars to steal and drive, with arcade handling, damage, and repair
- A wanted system: five stars of police response, from patrol cars to full pursuit
- Six story missions with a crew, a rival gang, and a finale
- Combat with pistols and a buyable SMG, health and armor
- HUD with minimap, cash, wanted stars, and mission objectives
- Synthesized sound: engine, sirens, gunshots, and a bassline — no audio files
- Saved progress in the browser (localStorage)

## Build

Plain static files, no build step, no network requests. The game is vanilla JavaScript on a 2D canvas, split into one file per system under `game/src/`.
