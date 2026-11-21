// Keyboard + mouse input: a key set, edge-triggered presses, and drag-to-orbit
// for the chase camera. No pointer lock — the game must also work in a screenshot.

export function createInput() {
  return {
    keys: new Set(),
    pressed: new Set(), // keys pressed since the last frame (edge-triggered)
    mouseDown: false,
    orbitYaw: 0,        // drag offset added to the camera yaw
    orbitTarget: 0,
    lastX: 0,
    dragging: false,
  };
}

export function attachInput(input, canvas, callbacks) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    input.pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (callbacks.onKey) callbacks.onKey(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.dragging = true;
    input.lastX = e.clientX;
    if (callbacks.onMouseDown) callbacks.onMouseDown(e);
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
    input.dragging = false;
    // Orbit springs back toward zero when released.
    input.orbitTarget = 0;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    const dx = e.clientX - input.lastX;
    input.lastX = e.clientX;
    input.orbitTarget = Math.max(-1.2, Math.min(1.2, input.orbitTarget + dx * 0.004));
  });
  return input;
}

export function endFrameInput(input) {
  input.pressed.clear();
  // Orbit eases back to centre.
  input.orbitYaw += (input.orbitTarget - input.orbitYaw) * 0.12;
}

export function wasPressed(input, code) {
  return input.pressed.has(code);
}
