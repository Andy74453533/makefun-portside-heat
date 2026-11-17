// Keyboard and mouse, read fresh every frame. Movement keys are checked by
// name so the game loop can ask "is up held?" without caring which physical
// key it was. The mouse position is kept in screen pixels; the game turns
// it into a world aim point.

export const ACTION = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  SPRINT: 'sprint',
  BRAKE: 'brake',
  INTERACT: 'interact',
  SHOOT: 'shoot',
  PAUSE: 'pause',
  MISSIONS: 'missions',
  RELOAD: 'reload',
};

const KEY_BINDINGS = {
  KeyW: ACTION.UP, ArrowUp: ACTION.UP,
  KeyS: ACTION.DOWN, ArrowDown: ACTION.DOWN,
  KeyA: ACTION.LEFT, ArrowLeft: ACTION.LEFT,
  KeyD: ACTION.RIGHT, ArrowRight: ACTION.RIGHT,
  ShiftLeft: ACTION.SPRINT, ShiftRight: ACTION.SPRINT,
  Space: ACTION.BRAKE,
  KeyE: ACTION.INTERACT, Enter: ACTION.INTERACT,
  KeyP: ACTION.PAUSE, Escape: ACTION.PAUSE,
  KeyM: ACTION.MISSIONS,
  KeyR: ACTION.RELOAD,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, pressed: false };

  function onKeyDown(event) {
    const action = KEY_BINDINGS[event.code];
    if (action) {
      if (!held.has(action)) pressed.add(action);
      held.add(action);
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    const action = KEY_BINDINGS[event.code];
    if (action) held.delete(action);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouse.down = true;
      mouse.pressed = true;
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    isDown(action) {
      return held.has(action);
    },
    // True once, on the frame the key or button went down.
    wasPressed(action) {
      if (action === ACTION.SHOOT) return mouse.pressed;
      return pressed.has(action);
    },
    axis() {
      let x = 0;
      let y = 0;
      if (held.has(ACTION.LEFT)) x -= 1;
      if (held.has(ACTION.RIGHT)) x += 1;
      if (held.has(ACTION.UP)) y -= 1;
      if (held.has(ACTION.DOWN)) y += 1;
      return { x, y };
    },
    endFrame() {
      pressed.clear();
      mouse.pressed = false;
    },
  };
}

// A scripted input for the screenshot scenes: the autopilot fills this in
// instead of a keyboard, and the game reads it the same way.
export function createScriptedInput() {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, pressed: false };
  return {
    mouse,
    set(action, value) {
      if (value) {
        if (!held.has(action)) pressed.add(action);
        held.add(action);
      } else {
        held.delete(action);
      }
    },
    press(action) {
      pressed.add(action);
      held.add(action);
    },
    setMouse(x, y, down) {
      mouse.x = x; mouse.y = y; mouse.down = down;
      if (down) mouse.pressed = true;
    },
    isDown(action) {
      return held.has(action);
    },
    wasPressed(action) {
      if (action === ACTION.SHOOT) return mouse.pressed;
      return pressed.has(action);
    },
    axis() {
      let x = 0;
      let y = 0;
      if (held.has(ACTION.LEFT)) x -= 1;
      if (held.has(ACTION.RIGHT)) x += 1;
      if (held.has(ACTION.UP)) y -= 1;
      if (held.has(ACTION.DOWN)) y += 1;
      return { x, y };
    },
    endFrame() {
      pressed.clear();
      mouse.pressed = false;
    },
  };
}
