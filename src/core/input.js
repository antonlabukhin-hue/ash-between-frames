// Единый ввод: клавиатура+мышь, геймпад, сенсор (кнопки впрыскиваются из mobile/touch.js).
// Игра читает действия: move, aim, pressed(action), down(action).

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyJ: 'attack', KeyK: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
  KeyQ: 'shift', KeyE: 'interact', KeyF: 'interact', Space: 'rift',
  Digit1: 'ab1', Digit2: 'ab2', Digit3: 'ab3',
  Escape: 'pause', KeyP: 'pause', Tab: 'map', Enter: 'confirm', NumpadEnter: 'confirm',
};

// Стандартная раскладка геймпада.
const PADMAP = { 0: 'dodge', 1: 'interact', 2: 'attack', 3: 'shift', 5: 'rift', 4: 'ab1', 6: 'ab2', 7: 'ab3', 9: 'pause', 8: 'map', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

export function createInput(renderer) {
  const down = new Set();
  const pressed = new Set();
  const injected = new Set(); // удерживаемые кнопки с экрана
  const padDown = new Set();
  const st = {
    move: { x: 0, y: 0 },
    aimDir: null, // направление прицела (геймпад/сенсор), null — автонаведение
    mouse: { x: 192, y: 108, active: false, moved: 0 },
    device: 'kb',
    touchMove: { x: 0, y: 0 },
    touchAim: null,
    enabled: true,
  };

  const press = (a) => {
    if (!down.has(a) && !injected.has(a) && !padDown.has(a)) pressed.add(a);
  };

  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    press(a);
    down.add(a);
    st.device = 'kb';
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) down.delete(a);
  });
  window.addEventListener('blur', () => down.clear());

  const canvas = renderer.canvas;
  window.addEventListener('mousemove', (e) => {
    const [x, y] = renderer.toCanvas(e.clientX, e.clientY);
    st.mouse.x = x;
    st.mouse.y = y;
    st.mouse.active = true;
    st.mouse.moved = performance.now();
    st.device = 'kb';
  });
  canvas.addEventListener('mousedown', (e) => {
    st.device = 'kb';
    st.mouse.active = true;
    const [mx, my] = renderer.toCanvas(e.clientX, e.clientY);
    st.mouse.x = mx;
    st.mouse.y = my;
    st.mouse.moved = performance.now();
    if (e.button === 0) {
      press('attack');
      down.add('attack');
    } else if (e.button === 2) {
      press('dodge');
      down.add('dodge');
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) down.delete('attack');
    if (e.button === 2) down.delete('dodge');
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return null;
    const now = new Set();
    pad.buttons.forEach((b, i) => {
      const a = PADMAP[i];
      if (a && (b.pressed || b.value > 0.5)) now.add(a);
    });
    for (const a of now) if (!padDown.has(a)) {
      pressed.add(a);
      st.device = 'pad';
    }
    padDown.clear();
    for (const a of now) padDown.add(a);
    const dz = (v) => (Math.abs(v) < 0.22 ? 0 : v);
    const lx = dz(pad.axes[0] ?? 0);
    const ly = dz(pad.axes[1] ?? 0);
    const rx = dz(pad.axes[2] ?? 0);
    const ry = dz(pad.axes[3] ?? 0);
    if (lx || ly || rx || ry) st.device = 'pad';
    return { lx, ly, rx, ry };
  }

  st.isDown = (a) => down.has(a) || injected.has(a) || padDown.has(a);
  st.pressed = (a) => pressed.has(a);
  st.consume = (a) => pressed.delete(a);
  st.anyPressed = (...as) => as.some((a) => pressed.has(a));
  // Для экранных кнопок.
  st.inject = (a, on) => {
    if (on) {
      if (!st.isDown(a)) pressed.add(a);
      injected.add(a);
    } else injected.delete(a);
    st.device = 'touch';
  };
  st.tap = (a) => {
    pressed.add(a);
    st.device = 'touch';
  };

  st.update = () => {
    const pad = pollPad();
    let x = (st.isDown('right') ? 1 : 0) - (st.isDown('left') ? 1 : 0);
    let y = (st.isDown('down') ? 1 : 0) - (st.isDown('up') ? 1 : 0);
    st.aimDir = null;
    if (pad) {
      if (pad.lx || pad.ly) {
        x = pad.lx;
        y = pad.ly;
      }
      if (pad.rx || pad.ry) st.aimDir = [pad.rx, pad.ry];
    }
    if (st.touchMove.x || st.touchMove.y) {
      x = st.touchMove.x;
      y = st.touchMove.y;
    }
    if (st.touchAim) st.aimDir = st.touchAim;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    st.move.x = x;
    st.move.y = y;
  };

  st.endFrame = () => pressed.clear();
  st.clear = () => {
    pressed.clear();
    down.clear();
    injected.clear();
  };
  // Мышь управляет прицелом, если ею двигали недавно и игрок на клавиатуре.
  st.mouseAims = () => st.device === 'kb' && st.mouse.active;
  return st;
}
