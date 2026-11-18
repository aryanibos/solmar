// Keyboard and mouse input. Held keys are read every frame; one-shot
// presses (enter a car, pause, mute, confirm) are queued as flags and
// taken once, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);
const ENTER = new Set(['KeyE']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const CONFIRM = new Set(['Enter']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let clicks = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    clicks += 1;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    get left() { return [...held].some((c) => LEFT.has(c)); },
    get right() { return [...held].some((c) => RIGHT.has(c)); },
    get up() { return [...held].some((c) => UP.has(c)); },
    get down() { return [...held].some((c) => DOWN.has(c)); },
    get run() { return [...held].some((c) => RUN.has(c)); },
    get handbrake() { return [...held].some((c) => HANDBRAKE.has(c)); },
    get mouseDown() { return mouse.down; },
    mouse,
    takeClicks() {
      const taken = clicks;
      clicks = 0;
      return taken;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
