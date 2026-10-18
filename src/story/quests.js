// Доска воспоминаний (docs/GAME_RESEARCH.md 3.5, как журнал корабля Outer Wilds): квест — это
// воспоминание, которому не хватает кусочков. Для каждого — что уже есть, чего не хватает и где
// искать. Модуль чистый: читает только save.
import { hasMemory, wasSpent } from './memories.js';

const mem = (s, id) => hasMemory(s, id) || wasSpent(s, id);
const f = (s) => s.flags || {};

export const QUESTS = [
  {
    id: 'camp',
    name: 'Арно и Сена',
    visible: (s) => !!f(s).visited?.camp || mem(s, 'nameScrap'),
    steps: [
      { label: 'Записка «…но, жди у ворот»', have: (s) => mem(s, 'nameScrap') || !!f(s).nameScrap || f(s).camp === 'both', where: 'Разорванная дорога, ниша наверху справа' },
      { label: 'Показать записку Сене', have: (s) => f(s).camp === 'both', where: 'Чужой привал — поговорить с Сеной' },
    ],
    done: (s) => !!f(s).camp,
    result: (s) =>
      ({ arno: 'Дорога оставила Арно.', sena: 'Дорога оставила Сену.', both: 'Остались оба — брат и сестра.', fixed: 'Остались оба — но чужими друг другу.' })[f(s).camp],
  },
  {
    id: 'boy',
    name: 'Кто заменил мальчика',
    visible: (s) => mem(s, 'lanternFeast') || !!(f(s).boyQuest || f(s).maraQuest || f(s).vaultTaken),
    steps: [
      { label: 'Воспоминание «Праздник фонарей»', have: (s) => mem(s, 'lanternFeast'), where: 'Площадь, у фонтана, когда горят два фонаря' },
      { label: 'Показать его Латунному Мальчику', have: (s) => !!f(s).boyQuest, where: 'Площадь — ожившая статуя' },
      { label: 'Показать его Маре', have: (s) => !!f(s).maraQuest, where: 'Подъём к колокольне' },
      { label: 'Кепка из тайника под мостовой', have: (s) => !!f(s).vaultTaken, where: 'Площадь — плита, которую накрывают ореолы двух фонарей' },
      { label: 'Отдать кепку Маре', have: (s) => !!f(s).boyFound, where: 'Кухня Последнего Дня' },
    ],
    done: (s) => !!f(s).boyFound,
    result: () => 'Мару сына звали Ян. Теперь его помнят двое — она и латунь.',
  },
  {
    id: 'dog',
    name: 'Имя пса',
    visible: (s) => mem(s, 'dogTag') || mem(s, 'dogBowl') || !!f(s).visited?.kitchen,
    steps: [
      { label: 'Жетон «Гр…»', have: (s) => mem(s, 'dogTag'), where: 'Разорванная дорога, у разбитой колонны слева внизу' },
      { label: 'Миска «…ом»', have: (s) => mem(s, 'dogBowl'), where: 'Пепельные руины, после вылазки' },
      { label: 'Назвать пса', have: (s) => !!f(s).dogNamed, where: 'Кухня Последнего Дня — Старый Пёс' },
    ],
    done: (s) => !!f(s).dogNamed,
    result: () => 'Его зовут Гром. На вылазках он находит зарытую золу.',
  },
  {
    id: 'song',
    name: 'Последний звон',
    visible: (s) => mem(s, 'ringerSong') || f(s).bellChoice === 'lastRing',
    steps: [
      { label: 'Воспоминание «Песня звонаря»', have: (s) => mem(s, 'ringerSong'), where: 'Звонкая Тень — победить, ни разу не попав под волну' },
      { label: 'Воспоминание «Праздник фонарей»', have: (s) => mem(s, 'lanternFeast'), where: 'Площадь, у фонтана, когда горят два фонаря' },
      { label: 'Позвонить в последний раз', have: (s) => f(s).bellChoice === 'lastRing', where: 'Под площадью — финальный выбор главы' },
    ],
    done: (s) => f(s).bellChoice === 'lastRing',
    // нужные воспоминания уже отданы в другом месте — этот звон не собрать
    // (проверяется, только пока квест не выполнен)
    lost: (s) => !!f(s).bellChoice || wasSpent(s, 'lanternFeast') || wasSpent(s, 'ringerSong'),
    result: () => 'Звон отпустил всех. Колокол остался в прошлом.',
  },
];

// Доска: видимые квесты с шагами; next — первый недостающий шаг (с подсказкой, где искать).
export function questBoard(save) {
  return QUESTS.filter((q) => q.visible(save)).map((q) => {
    const steps = q.steps.map((st) => ({ label: st.label, have: !!st.have(save), where: st.where }));
    const done = q.done(save);
    const lost = !done && !!q.lost?.(save);
    return { id: q.id, name: q.name, done, lost, result: done ? q.result?.(save) ?? '' : '', steps, next: done || lost ? null : steps.find((st) => !st.have) ?? null };
  });
}
