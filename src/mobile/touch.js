// Виртуальные кнопки для телефона: левый плавающий стик, справа — удар, уклонение,
// смена состояния (часы), разлом и контекстное «взаимодействие».
// Свайп по правой части — уклонение в сторону свайпа, тап — удар в точку.

const capture = (el, id) => {
  try {
    el.setPointerCapture(id);
  } catch {
    /* указатель уже отпущен */
  }
};

export function createTouch(root, input, renderer) {
  const st = { enabled: false, visible: true, g: null };
  const zone = document.createElement('div');
  zone.className = 'stick-zone';
  const stick = document.createElement('div');
  stick.className = 'stick hidden';
  stick.innerHTML = '<div class="knob"></div>';
  const knob = stick.firstChild;
  root.append(zone, stick);

  // name — подпись для экранного диктора, label — значок на кнопке
  const mk = (cls, label, action, name) => {
    const b = document.createElement('button');
    b.className = `tbtn ${cls}`;
    b.type = 'button';
    b.dataset.action = action;
    b.setAttribute('aria-label', name);
    b.title = name;
    const icon = document.createElement('span');
    icon.className = 'ticon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = label;
    b.appendChild(icon);
    root.appendChild(b);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      capture(b, e.pointerId);
      b.classList.add('down');
      input.inject(action, true);
    });
    const up = (e) => {
      e.preventDefault();
      b.classList.remove('down');
      input.inject(action, false);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    return b;
  };
  const btn = {
    attack: mk('attack', '⚔', 'attack', 'Удар'),
    dodge: mk('dodge', '↷', 'dodge', 'Уклонение'),
    shift: mk('shift', '⧗', 'shift', 'Сдвиг: в прошлое'),
    rift: mk('rift', '✦', 'rift', 'Разлом'),
    interact: mk('interact', '✋', 'interact', 'Взаимодействие'),
    ab1: mk('ab ab1', '1', 'ab1', 'Способность 1'),
    ab2: mk('ab ab2', '2', 'ab2', 'Способность 2'),
    ab3: mk('ab ab3', '3', 'ab3', 'Способность 3'),
    echo: mk('echo', '◐', 'echo', 'Эхо: запись'),
    gaze: mk('gaze', '◉', 'gaze', 'Взгляд Смотрителя (удерживать)'),
  };

  let stickId = null;
  let ox = 0;
  let oy = 0;
  const R = 46;
  zone.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId;
    capture(zone, e.pointerId);
    const rect = root.getBoundingClientRect();
    ox = e.clientX - rect.left;
    oy = e.clientY - rect.top;
    stick.style.left = `${ox}px`;
    stick.style.top = `${oy}px`;
    stick.classList.remove('hidden');
    knob.style.transform = '';
    input.device = 'touch';
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    const rect = root.getBoundingClientRect();
    let dx = e.clientX - rect.left - ox;
    let dy = e.clientY - rect.top - oy;
    const l = Math.hypot(dx, dy);
    if (l > R) {
      dx = (dx / l) * R;
      dy = (dy / l) * R;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const k = Math.min(1, l / R);
    input.touchMove.x = l > 6 ? (dx / Math.max(1, Math.hypot(dx, dy))) * k : 0;
    input.touchMove.y = l > 6 ? (dy / Math.max(1, Math.hypot(dx, dy))) * k : 0;
  });
  const release = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    stick.classList.add('hidden');
    input.touchMove.x = 0;
    input.touchMove.y = 0;
  };
  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);

  // правая часть холста: тап — удар в точку, свайп — уклонение
  const swipe = new Map();
  renderer.canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    swipe.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
  });
  renderer.canvas.addEventListener('pointerup', (e) => {
    const s = swipe.get(e.pointerId);
    swipe.delete(e.pointerId);
    if (!s || !st.g || st.g.scene !== 'play') return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = performance.now() - s.t;
    const p = st.g.player;
    if (!p) return;
    if (Math.hypot(dx, dy) > 36 && dt < 350) {
      input.touchAim = [dx, dy];
      input.tap('dodge');
      setTimeout(() => (input.touchAim = null), 60);
    } else if (dt < 300) {
      const [cx, cy] = renderer.toCanvas(e.clientX, e.clientY);
      const wx = cx + st.g.cam.x;
      const wy = cy + st.g.cam.y;
      input.touchAim = [wx - p.x, wy - (p.y - 8)];
      input.tap('attack');
      setTimeout(() => (input.touchAim = null), 200);
    }
  });

  const detect = () => {
    if (st.enabled) return;
    st.enabled = true;
    input.device = 'touch';
  };
  window.addEventListener('touchstart', detect, { passive: true });
  if (matchMedia('(pointer: coarse)').matches) detect();

  st.applySettings = (s) => {
    root.style.setProperty('--bs', s.buttonScale);
    root.style.setProperty('--so', s.stickOpacity);
  };

  st.update = (g, show) => {
    st.g = g;
    const on = st.enabled && show;
    if (on !== st.visible) {
      st.visible = on;
      root.classList.toggle('on', on);
      for (const b of Object.values(btn)) b.classList.toggle('hidden', !on);
      zone.classList.toggle('hidden', !on);
      if (!on) {
        for (const b of Object.values(btn)) b.classList.remove('down');
        input.touchMove.x = input.touchMove.y = 0;
        stick.classList.add('hidden');
        stickId = null;
      }
    }
    if (!on || !g.player) return;
    btn.interact.classList.toggle('hidden', !g.interactTarget);
    ['ab1', 'ab2', 'ab3'].forEach((k, i) => btn[k].classList.toggle('hidden', !g.flags?.[['abSpark', 'abSeam', 'abShade'][i]]));
    btn.rift.classList.toggle('ready', g.player.rift >= 1);
    btn.echo.classList.toggle('hidden', !g.flags?.echoUnlocked);
    btn.echo.classList.toggle('rec', !!g.player.echoRec);
    btn.shift.style.opacity = g.player.shiftTarget ? '1' : '0.55';
  };
  st.update({}, false);
  return st;
}
