// Воспоминания (docs/TIME_DESIGN.md, П5): знание и предмет одновременно. Получаются, если
// досмотреть сцену прошлого или найти обрывок; их предъявляют в разговорах, ими открывают
// механизмы памяти и платят в Узлах памяти (закрепление). Модуль чистый: состояние — в save.

export const MEMORIES = {
  fair: {
    name: 'Ярмарка у ворот',
    text: 'Торговцы тракта зазывают в Колокольные Ворота: «Последний звон перед праздником — успейте до ночи!»',
    place: 'Затухший тракт',
  },
  nameScrap: {
    name: 'Записка «…но, жди у ворот»',
    text: 'Клочок с чужим почерком: «…но, жди меня у ворот. С.» Имя без начала, подпись — одна буква.',
    place: 'Разорванная дорога',
  },
  dogTag: {
    name: 'Жетон «Гр…»',
    text: 'Медный жетон с собачьего ошейника: «Гр…». Остальное стёрто. Чей-то пёс ждал у дороги.',
    place: 'Разорванная дорога',
  },
  dogBowl: {
    name: 'Миска «…ом»',
    text: 'Собачья миска в руинах. На дне выцарапано: «…ом». Кто-то кормил пса до самого Стирания.',
    place: 'Пепельные руины',
  },
  campfire: {
    name: 'Вечер у костра',
    text: 'Сена раздувает огонь, Арно уходит вперёд разведать дорогу и обещает вернуться до звона.',
    place: 'Чужой привал',
  },
  ringerSong: {
    name: 'Песня звонаря',
    text: 'Обрывок мелодии из звона Тени: четыре удара, пауза, два. Так Мел звал город на праздник — не в пустоту.',
    place: 'Звонкая Тень',
  },
  lanternFeast: {
    name: 'Праздник фонарей',
    text: 'Площадь в огнях. Мальчик в латунной кепке теряется в толпе; женщина в платке зовёт его по имени — имя тонет в звоне.',
    place: 'Площадь без центра',
  },
};

export const isMemory = (id) => !!MEMORIES[id];
export const hasMemory = (save, id) => !!save.memories?.includes(id);
export const wasSpent = (save, id) => !!save.spentMemories?.includes(id);

// Добавить воспоминание. false — неизвестное, уже есть или уже отдано (отданное не возвращается).
export function addMemory(save, id) {
  if (!isMemory(id) || hasMemory(save, id) || wasSpent(save, id)) return false;
  (save.memories ||= []).push(id);
  return true;
}

// Отдать воспоминание (Узел памяти): оно исчезает из дневника и из мира.
export function spendMemory(save, id) {
  if (!hasMemory(save, id)) return false;
  save.memories = save.memories.filter((m) => m !== id);
  (save.spentMemories ||= []).push(id);
  return true;
}

export const memoryList = (save) => (save.memories || []).filter(isMemory).map((id) => ({ id, ...MEMORIES[id] }));

// ── сцены прошлого ───────────────────────────────────────────────────────
// Сцена — последовательность реплик призраков. Играет, пока выполнено условие (герой рядом,
// прошлое проявлено). Прервалась — начнётся заново; досмотрена — даёт воспоминание.
// lines: [{ who, text, dur }]; возвращает состояние для шага.
export function createScene(lines) {
  return { lines, i: -1, t: 0, done: false };
}

// Шаг сцены. active — можно ли сейчас её смотреть. Возвращает событие:
// 'line' (началась реплика i), 'reset' (прервали), 'done' (досмотрена) или null.
export function stepScene(sc, active, dt) {
  if (sc.done) return null;
  if (!active) {
    if (sc.i >= 0) {
      sc.i = -1;
      sc.t = 0;
      return 'reset';
    }
    return null;
  }
  if (sc.i < 0) {
    sc.i = 0;
    sc.t = 0;
    return 'line';
  }
  sc.t += dt;
  if (sc.t >= (sc.lines[sc.i].dur ?? 2.8)) {
    sc.i++;
    sc.t = 0;
    if (sc.i >= sc.lines.length) {
      sc.done = true;
      return 'done';
    }
    return 'line';
  }
  return null;
}
