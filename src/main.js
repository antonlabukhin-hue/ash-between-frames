// Точка входа: меню, игровой цикл, пауза, настройки, смерть.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '../css/style.css';
import { createRenderer } from './core/renderer.js';
import { createInput } from './core/input.js';
import { createAudio } from './core/audio.js';
import { createUI } from './ui/overlay.js';
import { createGame } from './game.js';
import { loadSave, hasProgress } from './save/save.js';
import { renderWorld } from './render.js';
import { drawTitle } from './scenes/title.js';
import { createTouch } from './mobile/touch.js';
import { ROOMS } from './scenes/rooms.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('screen');
const renderer = createRenderer(canvas, stage);
const input = createInput(renderer);
const audio = createAudio();
const ui = createUI(document.getElementById('ui'), { audio });
const save = loadSave(window.localStorage);
const game = createGame({ input, audio, ui, storage: window.localStorage, save });
const touch = createTouch(document.getElementById('touch'), input, renderer);

function applySettings() {
  const s = save.settings;
  audio.setVolumes(s.music, s.sfx);
  renderer.setInteger(s.integerScale);
  touch.applySettings(s);
}
applySettings();

const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// ── меню ─────────────────────────────────────────────────────────────
const LOGO = '<h1>ПЕПЕЛ МЕЖДУ КАДРАМИ</h1><p>мир забывает самого себя</p>';

function titleMenu() {
  game.scene = 'title';
  ui.setBoss(null);
  audio.setMusic('title');
  const cont = hasProgress(save);
  ui.menu({
    cls: 'title',
    dim: false,
    logo: LOGO,
    foot: 'v0.1 · прототип главы 1',
    items: [
      { text: 'Продолжить', disabled: !cont, on: () => startGame(save.room) },
      { text: 'Новая игра', on: () => (cont ? confirmNew() : newGame()) },
      { text: 'Настройки', on: () => settingsMenu(titleMenu) },
      { text: 'Управление', on: () => controlsMenu(titleMenu) },
      { text: 'Об игре', on: aboutMenu },
    ],
  });
}

function confirmNew() {
  ui.menu({
    title: 'Начать заново?',
    extra: note('Прогресс главы, зола и улучшения будут стёрты. Настройки останутся.'),
    items: [
      { text: 'Да, стереть', on: newGame },
      { text: 'Нет', on: titleMenu },
    ],
    back: titleMenu,
  });
}

function newGame() {
  game.newGame();
  startGame('road');
}

async function startGame(roomId) {
  ui.closeMenu();
  audio.unlock();
  await ui.fade(true);
  game.scene = 'play';
  game.paused = false;
  game.player = null;
  game.loadRoom(ROOMS[roomId] ? roomId : 'road');
  if (!game.holdFade) await ui.fade(false);
}

function note(text) {
  const d = document.createElement('div');
  d.className = 'note';
  d.textContent = text;
  return d;
}

function aboutMenu() {
  ui.menu({
    title: 'Пепел между кадрами',
    extra: note(
      'Пиксельная action-RPG. Мир стирается из истории из-за Нулевой Свечи. Рен, Последний Смотритель, умеет ненадолго возвращать вещам и врагам их прошлое — Отпечаток — вместо Шрама, которым они стали. Прототип первой главы «Колокол, который не помнит удара».',
    ),
    items: [{ text: 'Назад', on: titleMenu }],
    back: titleMenu,
  });
}

function controlsMenu(back) {
  const d = document.createElement('div');
  d.innerHTML = `<div class="keys">
    <b>WASD / стрелки</b><span>движение</span>
    <b>ЛКМ / J</b><span>удар (жми снова на вспышке клинка)</span>
    <b>ПКМ / Shift / K</b><span>уклонение</span>
    <b>Q</b><span>сменить состояние цели: Отпечаток ⇄ Шрам</span>
    <b>E</b><span>взаимодействие</span>
    <b>Пробел</b><span>импульсный разлом (когда шкала полна)</span>
    <b>Esc</b><span>пауза</span>
  </div>
  <div class="note">Геймпад: левый стик — движение, правый — прицел, X — удар, A — уклонение, Y — сдвиг, B — взаимодействие, RB — разлом.<br>Телефон: левый стик, ⚔ удар, ↷ уклонение, ⧗ сдвиг, ✦ разлом; тап по экрану — удар в точку, свайп — уклонение.</div>`;
  ui.menu({ title: 'Управление', extra: d, items: [{ text: 'Назад', on: back }], back });
}

function settingsMenu(back) {
  const s = save.settings;
  const box = document.createElement('div');
  const row = (label, inputEl) => {
    const r = document.createElement('label');
    r.className = 'row';
    const sp = document.createElement('span');
    sp.textContent = label;
    r.append(sp, inputEl);
    box.appendChild(r);
  };
  const slider = (key, min, max, step) => {
    const i = document.createElement('input');
    i.type = 'range';
    i.min = min;
    i.max = max;
    i.step = step;
    i.value = s[key];
    i.addEventListener('input', () => {
      s[key] = Number(i.value);
      applySettings();
      game.persist();
    });
    return i;
  };
  const toggle = (key) => {
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = !!s[key];
    i.addEventListener('change', () => {
      s[key] = i.checked;
      applySettings();
      game.persist();
    });
    return i;
  };
  row('Музыка', slider('music', 0, 1, 0.05));
  row('Звуки', slider('sfx', 0, 1, 0.05));
  row('Вибрация', toggle('vibration'));
  row('Тряска экрана', toggle('screenShake'));
  row('Упрощённый бой (автоудар)', toggle('autoAttack'));
  row('Автонаведение', toggle('autoAim'));
  row('Целочисленный масштаб', toggle('integerScale'));
  row('Размер кнопок', slider('buttonScale', 0.7, 1.5, 0.05));
  row('Прозрачность стика', slider('stickOpacity', 0.15, 1, 0.05));
  ui.menu({ title: 'Настройки', extra: box, items: [{ text: 'Готово', on: back }], back });
}

function pauseMenu() {
  if (game.scene !== 'play' || ui.mode) return;
  game.paused = true;
  const resume = () => {
    ui.closeMenu();
    game.paused = false;
    input.clear();
  };
  ui.menu({
    title: 'Пауза',
    items: [
      { text: 'Продолжить', on: resume },
      { text: 'Настройки', on: () => settingsMenu(pauseMenu2) },
      { text: 'Управление', on: () => controlsMenu(pauseMenu2) },
      { text: 'В главное меню', on: () => quitToTitle() },
    ],
    back: resume,
  });
}
function pauseMenu2() {
  ui.closeMenu();
  pauseMenu();
}

async function quitToTitle() {
  ui.closeAll();
  await ui.fade(true);
  game.scene = 'title';
  game.room = null;
  game.paused = false;
  game.scriptToken++;
  titleMenu();
  await ui.fade(false);
}

game.onDeath = () => {
  ui.closeAll();
  ui.menu({
    title: 'Тебя стёрло',
    extra: note('Сюжет помнит тебя — ты вернёшься к началу комнаты. Временные фрагменты рассыпались.'),
    items: [
      {
        text: 'Вспомнить себя',
        on: () => {
          ui.closeMenu();
          game.retryRoom();
        },
      },
      { text: 'В главное меню', on: () => quitToTitle() },
    ],
  });
};

const pauseBtn = ui.pauseButton(() => pauseMenu());

// ── цикл ─────────────────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.update();
  const consumed = ui.handleInput(input);
  if (!consumed && input.pressed('pause') && game.scene === 'play') pauseMenu();
  if (game.scene === 'title') {
    ui.typewriter(dt);
    game.time += dt;
    drawTitle(renderer.ctx, game.time);
  } else {
    game.update(dt);
    renderWorld(game, renderer.ctx);
  }
  const playing = game.scene === 'play' && !ui.mode && !game.cinematic && !game.paused;
  touch.update(game, playing);
  pauseBtn.classList.toggle('hidden', !(game.scene === 'play' && !ui.mode && touch.enabled));
  input.endFrame();
  requestAnimationFrame(frame);
}

titleMenu();
requestAnimationFrame(frame);

if (__DEBUG__) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Поставить комнату для осмотра: без диалогов, с подготовкой сцены.
  const shot = async (id, setup) => {
    game.flags.introSeen = true;
    await startGame(id);
    await sleep(1800);
    ui.closeAll();
    game.cinematic = false;
    setup?.(game);
    await sleep(500);
    return id;
  };
  const skip = async () => {
    for (let i = 0; i < 20 && ui.mode === 'dialogue'; i++) {
      input.tap('confirm');
      await sleep(120);
    }
  };
  window.__abf = { game, save, ui, input, rooms: ROOMS, startGame, shot, skip, sleep };
  const q = new URLSearchParams(location.search);
  if (q.get('room')) startGame(q.get('room'));
}
