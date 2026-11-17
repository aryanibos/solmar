// Save and load through localStorage: money, missions finished, health,
// ammo, the pistol, and where the player stood. The wanted level is never
// saved — the heat always cools while the game is off.

export const SAVE_KEY = 'solmar-save-v1';

export function saveGame(game) {
  try {
    const data = {
      money: game.player.money,
      missionsDone: game.missionsDone,
      health: game.player.health,
      ammo: game.player.ammo,
      hasPistol: game.player.hasPistol,
      x: game.player.x,
      y: game.player.y,
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
    return data;
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
