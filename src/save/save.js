// Сохранение прогресса в localStorage. Чистые функции + тонкая обёртка над хранилищем.

export const SAVE_KEY = 'abf_save_v1';
export const SAVE_VERSION = 1;

export function defaultSettings() {
  return {
    music: 0.6,
    sfx: 0.8,
    vibration: true,
    autoAttack: false, // упрощённый режим для телефона
    autoAim: true,
    buttonScale: 1,
    stickOpacity: 0.5,
    integerScale: true,
    screenShake: true,
  };
}

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    started: false,
    room: 'road', // комната, с которой продолжить
    chapterDone: false,
    ash: 0, // зола
    shards: 0, // осколки мгновений
    upgrades: { hp: 0, charges: 0, quickSeam: false },
    flags: {},
    fragments: [], // временные фрагменты вылазки
    items: [], // предметы убежища (хлеб и т.п.)
    stats: { deaths: 0, kills: 0, playTime: 0 },
    settings: defaultSettings(),
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Разбор с проверкой: битое сохранение не должно ломать игру.
export function parseSave(str) {
  const base = defaultSave();
  if (!str) return base;
  let raw;
  try {
    raw = JSON.parse(str);
  } catch {
    return base;
  }
  if (!isObj(raw)) return base;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    if (!(k in raw)) continue;
    const v = raw[k];
    const d = base[k];
    if (isObj(d)) out[k] = isObj(v) ? { ...d, ...v } : d;
    else if (Array.isArray(d)) out[k] = Array.isArray(v) ? v.slice() : d;
    else if (typeof v === typeof d) out[k] = v;
  }
  out.version = SAVE_VERSION;
  out.ash = Math.max(0, Math.floor(out.ash));
  out.shards = Math.max(0, Math.floor(out.shards));
  return out;
}

export const serializeSave = (s) => JSON.stringify(s);

export function loadSave(storage) {
  try {
    return parseSave(storage?.getItem(SAVE_KEY));
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage, s) {
  try {
    storage?.setItem(SAVE_KEY, serializeSave(s));
    return true;
  } catch {
    return false;
  }
}

export const hasProgress = (s) => !!s.started;

// Новая игра сохраняет настройки.
export function freshSave(prev) {
  const s = defaultSave();
  if (prev?.settings) s.settings = { ...s.settings, ...prev.settings };
  return s;
}
