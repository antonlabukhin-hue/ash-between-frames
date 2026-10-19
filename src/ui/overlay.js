// HTML-слой поверх холста: диалоги, выборы, меню, подсказки.
// Текст рисуется пиксельным шрифтом с кириллицей в разрешении экрана — читаемо на телефоне.
import { drawHero, drawTik, drawMara, drawGhost, drawBrassBoy, drawMel, drawDog, drawHollow } from '../art/sprites.js';
import { P } from '../art/palette.js';

const PORTRAITS = {
  ren: (c) => drawHero(c, 16, 38, { dir: 'down', charges: 3, t: 0 }),
  tik: (c) => drawTik(c, 16, 30, {}),
  mara: (c) => drawMara(c, 16, 34, {}),
  arno: (c) => drawGhost(c, 16, 34, { hat: true, alpha: 1 }),
  sena: (c) => drawGhost(c, 16, 34, { dress: true, alpha: 1, color: P.amberHi }),
  boy: (c) => drawBrassBoy(c, 16, 46, { phase: 'past' }),
  mel: (c) => drawMel(c, 16, 84, {}),
  dog: (c) => drawDog(c, 14, 28, {}),
  hollow: (c) => drawHollow(c, 16, 38, { phase: 'past' }),
  villager: (c) => drawGhost(c, 16, 34, { alpha: 1, color: P.milk }),
};

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export function createUI(root, { audio }) {
  const ui = { mode: null };
  const banner = el('div', 'banner passive', root);
  const hint = el('div', 'hint off', root);
  const toast = el('div', 'toast passive off', root);
  // строка подсказки — для экранного диктора; видимая информация — таблички над объектами
  const prompt = el('div', 'prompt passive hidden', root);
  prompt.setAttribute('aria-live', 'polite');
  const plateEls = [el('div', 'plate passive hidden', root), el('div', 'plate passive hidden', root)];
  const plateKeys = ['', ''];
  const caption = el('div', 'caption passive', root);
  const bossname = el('div', 'bossname passive hidden', root);
  const card = el('div', 'card passive hidden', root);
  const fade = el('div', 'fade passive', root);
  let menuEl = null;
  let menuItems = [];
  let menuFocus = 0;
  let menuBack = null;
  let dlg = null; // {el, lines, i, shown, full, resolve}
  let choice = null;
  const timers = {};

  const later = (key, ms, fn) => {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(fn, ms);
  };

  ui.hideBanner = () => {
    clearTimeout(timers.banner);
    banner.classList.remove('show');
  };
  // Перед модальным окном убираем временные слои: под выбором и диалогом не должно быть старого текста.
  ui.clearTransient = (all = true) => {
    ui.hideHintFor(true); // вернётся после диалога
    ui.hideBanner();
    ui.setPrompt(null);
    ui.setPlates([]);
    ui.setBarks?.([]);
    ui.setTags?.([]);
    if (all) {
      ui.caption(null);
      toast.classList.add('off');
    }
  };

  ui.banner = (t, s = '', dur = 3.2) => {
    banner.innerHTML = `<div class="t">${esc(t)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}`;
    banner.classList.add('show');
    later('banner', dur * 1000, () => banner.classList.remove('show'));
  };

  // Подсказка — строка внизу по центру, как реплики: текст печатается и держится столько,
  // сколько нужно прочитать (не дольше dur). Непечатанная часть занимает место невидимо,
  // чтобы строка не прыгала.
  let hintText = '';
  let hintTimer = 0;
  const typedHtml = (html, n) => {
    let left = n;
    let out = '';
    let hidden = false;
    for (const part of html.split(/(<[^>]+>)/)) {
      if (!part) continue;
      if (part[0] === '<') {
        out += part;
        continue;
      }
      const chars = [...part];
      const shown = chars.slice(0, Math.max(0, left)).join('');
      const rest = chars.slice(Math.max(0, left)).join('');
      left -= chars.length;
      out += shown;
      if (rest) {
        out += `<span class="ghost">${rest}</span>`;
        hidden = true;
      }
    }
    return { out, done: !hidden };
  };
  const hintLen = (html) => html.replace(/<[^>]+>/g, '').length;
  // Подсказка не исчезает сама: висит, пока по ней не нажмут (щелчок или касание).
  // Новые встают в очередь и не затирают непрочитанную; на время диалога подсказка прячется.
  const queue = [];
  const close = '<span class="hx">✕</span>';
  const more = () => (queue.length ? `<span class="hq">ещё ${queue.length}</span>` : '');
  function showHint(html) {
    hintText = html;
    clearInterval(hintTimer);
    let n = 0;
    hint.innerHTML = typedHtml(html, 0).out + close + more();
    hintTimer = setInterval(() => {
      n += 2;
      const r = typedHtml(html, n);
      hint.innerHTML = r.out + close + more();
      if (r.done) clearInterval(hintTimer);
    }, 30);
    hint.classList.remove('off');
  }
  ui.hint = (html) => {
    if (html === hintText || queue.includes(html)) return;
    if (hintText) {
      queue.push(html);
      hint.querySelector('.hq')?.remove();
      hint.insertAdjacentHTML('beforeend', more());
      return;
    }
    showHint(html);
  };
  const nextHint = () => {
    clearInterval(hintTimer);
    hintText = '';
    if (queue.length) showHint(queue.shift());
    else hint.classList.add('off');
  };
  hint.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });
  hint.addEventListener('click', (e) => {
    e.stopPropagation();
    nextHint();
  });
  // сценарий больше не ждёт подсказку: очередь старых — прочь, но текущую закрывает только игрок
  ui.clearHint = () => {
    queue.length = 0;
    hint.querySelector('.hq')?.remove();
  };
  ui.hideHintFor = (on) => hint.classList.toggle('away', on);
  ui.hasHint = () => !!hintText;

  ui.toast = (text, dur = 2.2) => {
    toast.textContent = text;
    toast.classList.remove('off');
    later('toast', dur * 1000, () => toast.classList.add('off'));
  };

  let promptText = null;
  ui.setPrompt = (text) => {
    if (text === promptText) return;
    promptText = text;
    prompt.classList.toggle('hidden', !text);
    if (text) prompt.textContent = text; // переносы строк — white-space: pre-line
  };

  // Таблички над объектами (как подписи в Diablo): имя, действие с клавишей, цена сдвига.
  // list: [{ x, y — доли кадра, name, lines: [{key, text, cost}], tone, dim, progress }]
  ui.setPlates = (list) => {
    for (let i = 0; i < plateEls.length; i++) {
      const pl = list[i];
      const elp = plateEls[i];
      if (!pl) {
        if (plateKeys[i]) elp.classList.add('hidden');
        plateKeys[i] = '';
        continue;
      }
      const key = JSON.stringify([pl.name, pl.lines, pl.tone, pl.dim, pl.progress != null ? Math.round(pl.progress * 20) : -1]);
      if (key !== plateKeys[i]) {
        plateKeys[i] = key;
        const lines = pl.lines
          .map((l) => `<div class="ln">${l.key ? `<b class="key">${esc(l.key)}</b>` : ''}<span>${esc(l.text)}</span>${l.cost ? `<i class="cost">${'◆'.repeat(l.cost)}</i>` : ''}</div>`)
          .join('');
        const bar = pl.progress != null ? `<div class="bar"><i style="width:${Math.round(pl.progress * 100)}%"></i></div>` : '';
        elp.innerHTML = `${pl.name ? `<div class="nm">${esc(pl.name)}</div>` : ''}${lines}${bar}`;
        elp.className = `plate passive tone-${pl.tone}${pl.dim ? ' dim' : ''}`;
      }
      elp.style.left = `${(pl.x * 100).toFixed(2)}%`;
      elp.style.top = `${(pl.y * 100).toFixed(2)}%`;
    }
  };

  // Подписи «Взгляда Смотрителя»: над каждым интерактивным объектом — что с ним можно сделать.
  const tagEls = Array.from({ length: 12 }, () => el('div', 'gtag passive hidden', root));
  const tagKeys = tagEls.map(() => '');
  ui.setTags = (list) => {
    tagEls.forEach((elt, i) => {
      const t = list[i];
      if (!t) {
        if (tagKeys[i]) elt.className = 'gtag passive hidden';
        tagKeys[i] = '';
        return;
      }
      const key = t.kind + t.text;
      if (key !== tagKeys[i]) {
        tagKeys[i] = key;
        elt.textContent = t.text;
        elt.className = `gtag passive ${t.kind}`;
      }
      elt.style.left = `${(t.x * 100).toFixed(2)}%`;
      elt.style.top = `${(t.y * 100).toFixed(2)}%`;
    });
  };

  // Реплики сцен прошлого: короткий текст над говорящим призраком.
  const barkEls = [el('div', 'bark passive hidden', root), el('div', 'bark passive hidden', root)];
  const barkKeys = ['', ''];
  ui.setBarks = (list) => {
    barkEls.forEach((elb, i) => {
      const b = list[i];
      if (!b) {
        if (barkKeys[i]) elb.classList.add('hidden');
        barkKeys[i] = '';
        return;
      }
      const key = b.who + b.text;
      if (key !== barkKeys[i]) {
        barkKeys[i] = key;
        elb.innerHTML = `${b.who ? `<div class="who">${esc(b.who)}</div>` : ''}<div>${esc(b.text)}</div>`;
        elb.classList.remove('hidden');
      }
      elb.style.left = `${(b.x * 100).toFixed(2)}%`;
      elb.style.top = `${(b.y * 100).toFixed(2)}%`;
    });
  };

  ui.caption = (text, o = {}) => {
    caption.classList.remove('instant');
    if (text) caption.innerHTML = `<div>${esc(text).replace(/\n/g, '<br>')}${o.cont ? '<div class="cont">нажмите, чтобы продолжить</div>' : ''}</div>`;
    caption.classList.toggle('show', !!text);
  };
  ui.captionFull = () => caption.classList.add('instant');
  ui.captionShown = () => caption.classList.contains('show');

  ui.setBoss = (name, sub = '') => {
    bossname.classList.toggle('hidden', !name);
    if (name) bossname.innerHTML = `${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
  };

  ui.card = (kind, name, desc, dur = 3.2) => {
    card.innerHTML = `<div class="k">${esc(kind)}</div><div class="n">${esc(name)}</div><div class="d">${esc(desc)}</div>`;
    card.classList.remove('hidden');
    later('card', dur * 1000, () => card.classList.add('hidden'));
  };

  ui.fade = (on) =>
    new Promise((res) => {
      fade.classList.toggle('on', on);
      setTimeout(res, 380);
    });

  // ── диалог ────────────────────────────────────────────────────────
  // lines: [{who, text, portrait, style}] или строки
  ui.dialogue = (lines) =>
    new Promise((resolve) => {
      closeDialogue();
      ui.clearTransient(false);
      const box = el('div', 'dialogue', root);
      const pc = el('canvas', 'portrait', box);
      pc.width = 32;
      pc.height = 32;
      const body = el('div', 'body', box);
      const name = el('div', 'name', body);
      const text = el('div', 'text', body);
      el('div', 'next', box, '▼');
      dlg = { box, pc, name, text, lines: lines.map((l) => (typeof l === 'string' ? { text: l } : l)), i: -1, shown: 0, resolve };
      box.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        advance();
      });
      ui.mode = 'dialogue';
      nextLine();
    });

  function nextLine() {
    dlg.i++;
    if (dlg.i >= dlg.lines.length) {
      const r = dlg.resolve;
      closeDialogue();
      r();
      return;
    }
    const l = dlg.lines[dlg.i];
    dlg.name.textContent = l.who || '';
    dlg.name.className = `name ${l.style || ''}`;
    dlg.shown = 0;
    dlg.full = l.text;
    dlg.text.textContent = '';
    const draw = PORTRAITS[l.portrait];
    dlg.pc.classList.toggle('hidden', !draw);
    if (draw) {
      const c = dlg.pc.getContext('2d');
      c.fillStyle = '#121628';
      c.fillRect(0, 0, 32, 32);
      draw(c);
    }
  }

  function advance() {
    if (!dlg) return;
    if (dlg.shown < dlg.full.length) {
      dlg.shown = dlg.full.length;
      dlg.text.textContent = dlg.full;
    } else {
      audio.sfx.ui();
      nextLine();
    }
  }

  function closeDialogue() {
    if (dlg) dlg.box.remove();
    dlg = null;
    if (ui.mode === 'dialogue') ui.mode = null;
  }

  // ── выбор ─────────────────────────────────────────────────────────
  ui.choice = (promptText_, options) =>
    new Promise((resolve) => {
      closeChoice();
      ui.clearTransient(true);
      const dim = el('div', 'modal-dim', root);
      const box = el('div', 'choices', root);
      box.dim = dim;
      el('div', 'cprompt', box, esc(promptText_));
      const items = options.map((o, i) => {
        const b = el('button', `btn${o.disabled ? ' locked' : ''}`, box, `<span class="t">${esc(o.text)}</span>${o.sub ? `<span class="sub">${esc(o.sub)}</span>` : ''}`);
        b.disabled = !!o.disabled;
        b.addEventListener('click', () => {
          if (b.disabled) return;
          audio.sfx.uiOk();
          closeChoice();
          resolve(i);
        });
        return b;
      });
      choice = { box, items };
      menuItems = items;
      menuFocus = items.findIndex((b) => !b.disabled);
      menuBack = null;
      focusMenu();
      ui.mode = 'choice';
    });

  function closeChoice() {
    if (choice) {
      choice.box.dim?.remove();
      choice.box.remove();
    }
    choice = null;
    if (ui.mode === 'choice') ui.mode = menuEl ? 'menu' : null;
  }

  // ── меню ──────────────────────────────────────────────────────────
  // items: [{text, sub, on, disabled}] или DOM-узлы (настройки)
  ui.menu = ({ title, items = [], cls = '', dim = true, extra = null, back = null, logo = null, foot = null }) => {
    ui.closeMenu();
    menuEl = el('div', `menu ${cls} ${dim ? 'dim' : ''}`, root);
    if (logo) el('div', 'logo', menuEl, logo);
    if (foot) el('div', 'foot', menuEl, foot);
    const panel = el('div', 'panel', menuEl);
    if (title) el('h2', '', panel, esc(title));
    if (extra) panel.appendChild(extra);
    menuItems = items.map((it) => {
      const b = el('button', 'btn', panel, `${esc(it.text)}${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}`);
      b.disabled = !!it.disabled;
      b.type = 'button';
      // срабатывание один раз: и по click, и по отпусканию пальца (некоторые мобильные
      // браузеры не присылают click, если перед этим палец держал игровую кнопку)
      let fired = -Infinity;
      const activate = () => {
        if (b.disabled || !b.isConnected || performance.now() - fired < 500) return;
        fired = performance.now();
        audio.unlock();
        audio.sfx.uiOk();
        it.on();
      };
      b.addEventListener('click', () => {
        audio.unlock(); // click — жест, в котором iOS разрешает звук, даже если пункт уже сработал
        activate();
      });
      b.addEventListener('pointerup', (e) => {
        if (e.pointerType !== 'mouse') activate();
      });
      b.addEventListener('pointerenter', () => {
        menuFocus = menuItems.indexOf(b);
        focusMenu();
      });
      return b;
    });
    menuFocus = Math.max(0, menuItems.findIndex((b) => !b.disabled));
    menuBack = back;
    focusMenu();
    ui.mode = 'menu';
    return menuEl;
  };

  ui.closeMenu = () => {
    if (menuEl) menuEl.remove();
    menuEl = null;
    menuItems = [];
    if (ui.mode === 'menu') ui.mode = null;
  };

  function focusMenu() {
    menuItems.forEach((b, i) => b.classList.toggle('focus', i === menuFocus));
  }

  function moveFocus(d) {
    if (!menuItems.length) return;
    let i = menuFocus;
    for (let n = 0; n < menuItems.length; n++) {
      i = (i + d + menuItems.length) % menuItems.length;
      if (!menuItems[i].disabled) break;
    }
    menuFocus = i;
    audio.sfx.ui();
    focusMenu();
  }

  ui.closeAll = () => {
    closeDialogue();
    closeChoice();
    ui.closeMenu();
    ui.setPrompt(null);
    ui.caption(null);
  };

  let navLatch = 0;
  // Возвращает true, если интерфейс забрал ввод.
  ui.handleInput = (input) => {
    if (!ui.mode) return false;
    const ok = input.anyPressed('confirm', 'attack', 'interact');
    if (ui.mode === 'dialogue') {
      if (ok || input.pressed('dodge')) advance();
      return true;
    }
    // навигация стиком/стрелками
    let ny = 0;
    if (input.pressed('up')) ny = -1;
    if (input.pressed('down')) ny = 1;
    const sy = input.move.y;
    if (!ny && Math.abs(sy) > 0.6 && navLatch === 0) {
      ny = Math.sign(sy);
      navLatch = 1;
    }
    if (Math.abs(sy) < 0.3) navLatch = 0;
    if (ny) moveFocus(ny);
    // мышью кликают сами кнопки (они вне холста); клавиатура и геймпад — подтверждение
    if (ok && menuItems[menuFocus]) menuItems[menuFocus].click();
    if ((input.pressed('pause') || input.pressed('dodge') || input.pressed('map')) && menuBack) {
      audio.sfx.ui();
      menuBack();
    }
    return true;
  };

  ui.typewriter = (dt) => {
    if (!dlg || dlg.shown >= dlg.full.length) return;
    const before = Math.floor(dlg.shown);
    dlg.shown = Math.min(dlg.full.length, dlg.shown + dt * 48);
    const n = Math.floor(dlg.shown);
    if (n !== before) {
      dlg.text.textContent = dlg.full.slice(0, n);
      if (n % 3 === 0) audio.sfx.text();
    }
  };

  ui.pauseButton = (onClick) => {
    const b = el('button', 'pausebtn hidden', root, 'II');
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  return ui;
}
