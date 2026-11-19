// Keyboard, mouse and pointer-lock input. read() returns the shared actions object: held
// controls remain true, while look deltas and one-shot presses last for exactly one fixed step.

const CONTROL_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'Escape', 'Tab',
  'KeyR', 'Digit1', 'Digit2', 'Digit3',
]);

export function createInput(target) {
  const held = new Set();
  const pressed = new Set();
  const mouseButtons = new Set();
  const mousePressed = new Set();
  let lookX = 0;
  let lookY = 0;
  let wheel = 0;
  let pointerLocked = false;

  const actions = {
    forward: 0,
    right: 0,
    sprint: false,
    jump: false,
    jumpPressed: false,
    handbrake: false,
    interactPressed: false,
    pausePressed: false,
    map: false,
    mapPressed: false,
    fire: false,
    firePressed: false,
    aim: false,
    reloadPressed: false,
    weaponSlotPressed: 0,
    lookX: 0,
    lookY: 0,
    wheel: 0,
    pointerLocked: false,
  };

  window.addEventListener('keydown', (event) => {
    if (!CONTROL_CODES.has(event.code)) return;
    event.preventDefault();
    if (!event.repeat && !held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
  });

  window.addEventListener('keyup', (event) => {
    if (!CONTROL_CODES.has(event.code)) return;
    event.preventDefault();
    held.delete(event.code);
  });

  window.addEventListener('blur', () => {
    held.clear();
    pressed.clear();
    mouseButtons.clear();
    mousePressed.clear();
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === target;
    mouseButtons.clear();
  });

  document.addEventListener('mousemove', (event) => {
    if (!pointerLocked) return;
    lookX += event.movementX;
    lookY += event.movementY;
  });

  target.addEventListener('pointerdown', (event) => {
    if (pointerLocked) mousePressed.add(event.button);
    mouseButtons.add(event.button);
    if (!pointerLocked) {
      const request = target.requestPointerLock();
      if (request && typeof request.catch === 'function') request.catch(() => {});
    }
  });

  window.addEventListener('pointerup', (event) => {
    mouseButtons.delete(event.button);
  });

  target.addEventListener('wheel', (event) => {
    event.preventDefault();
    wheel += event.deltaY;
  }, { passive: false });

  target.addEventListener('contextmenu', (event) => event.preventDefault());

  function isHeld(...codes) {
    return codes.some((code) => held.has(code));
  }

  function read() {
    actions.forward = Number(isHeld('KeyW', 'ArrowUp')) - Number(isHeld('KeyS', 'ArrowDown'));
    actions.right = Number(isHeld('KeyD', 'ArrowRight')) - Number(isHeld('KeyA', 'ArrowLeft'));
    actions.sprint = isHeld('ShiftLeft', 'ShiftRight');
    actions.jump = held.has('Space');
    actions.jumpPressed = pressed.has('Space');
    actions.handbrake = held.has('Space');
    actions.interactPressed = pressed.has('KeyE');
    actions.pausePressed = pressed.has('Escape');
    actions.map = held.has('Tab');
    actions.mapPressed = pressed.has('Tab');
    actions.fire = mouseButtons.has(0) && pointerLocked;
    actions.firePressed = mousePressed.has(0) && pointerLocked;
    actions.aim = mouseButtons.has(2);
    actions.reloadPressed = pressed.has('KeyR');
    actions.weaponSlotPressed = pressed.has('Digit1') ? 1 : pressed.has('Digit2') ? 2 : pressed.has('Digit3') ? 3 : 0;
    actions.lookX = lookX;
    actions.lookY = lookY;
    actions.wheel = wheel;
    actions.pointerLocked = pointerLocked;

    pressed.clear();
    mousePressed.clear();
    lookX = 0;
    lookY = 0;
    wheel = 0;
    return actions;
  }

  return { actions, read, isPointerLocked: () => pointerLocked };
}
