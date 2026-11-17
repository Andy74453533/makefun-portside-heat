// Saved progress: cash, which story missions are done, and the player's
// lifetime stats. Kept in localStorage so a visit can continue where the
// last one stopped; a missing or broken save simply starts a fresh game.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    cash: 150,
    missionsDone: 0,
    kills: 0,
    carsStolen: 0,
    timesBusted: 0,
    timesWasted: 0,
    bestWanted: 0,
    playSeconds: 0,
    weapon: 'pistol',
    armor: 0,
  };
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
