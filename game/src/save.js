// Save format for Solmar (localStorage, key SAVE_KEY).
//
// Version 2 (current): the stored payload carries a `version` field, so
// saves from different builds can be recognised instead of silently
// misread:
//   {
//     version: 2, money, missionsDone, health, ammo, hasPistol,
//     x, y, savedAt
//   }
//
// Version 1 (legacy): the same fields without `version` — saves written
// before versioning was added. Still accepted on load.
// Any other version is rejected (loadGame returns null), so a save from
// an unknown format can never load as garbage.
//
// What is stored: money, missions finished, health, ammo, the pistol, and
// where the player stood. The wanted level is never saved — the heat
// always cools while the game is off.

export const SAVE_KEY = 'solmar-save-v1';

// Current save format version. Bump this whenever the stored payload gains,
// loses or changes a field, and teach loadGame how to read the old one.
export const SAVE_VERSION = 2;

export function saveGame(game) {
  try {
    // In the 3D build the player lives on the simulation (game.sim.player);
    // the old 2D path game.player no longer exists, so reading it here
    // would throw and every save would silently fail.
    const p = game.sim.player;
    const data = {
      version: SAVE_VERSION,
      money: p.money,
      missionsDone: game.missionsDone,
      health: p.health,
      ammo: p.ammo,
      hasPistol: p.hasPistol,
      x: p.x,
      y: p.y,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.x !== 'number') return null;
    // Version 1 saves have no `version` field; version 2 stamps it.
    // Anything else is a format we do not know — refuse it.
    if (data.version === undefined) return data;
    if (data.version === SAVE_VERSION) return data;
    return null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off; a save then simply does not persist.
  }
}
