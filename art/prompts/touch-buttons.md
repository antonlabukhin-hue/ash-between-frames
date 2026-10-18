# Сенсорные кнопки: параметры для генерации

Сейчас кнопки — значки-символы (⚔ ↷ ⧗ ✦ ✋ ◐) в рамках CSS. Нужен единый набор: **рамки**
отдельно, **значки** отдельно. Так одна рамка подходит к любой кнопке, а значки можно
перекрашивать под состояние (готово / нажато / нет заряда).

## Что сгенерировать

Два листа (две отдельные генерации). Каждый лист — **квадратная сетка на прозрачном или
чисто-чёрном (#000000) фоне**, ячейки одинаковые, между ячейками пустой зазор, без подписей.

### Лист 1. Рамки (3 ячейки в ряд, лист 1536×512)
1. **Большая круглая** — для удара. Кольцо из тёмной бронзы, по кругу мелкие руны.
2. **Средняя восьмиугольная** — для сдвига, уклонения, разлома, взаимодействия, Эха.
3. **Малая круглая** — для способностей 1–3 и паузы.

Внутри рамки — **пустой тёмный круг** (#0b0d1a, 80–85 % непрозрачности): туда встанет значок.
Толщина кольца — ~10 % диаметра. Свет сверху слева, без бликов-звёздочек.

### Лист 2. Значки (сетка 4×3, лист 2048×1536, ячейка 512×512)
Белые или светло-молочные (#ece4cf) **силуэты** с тонкой тёмной обводкой, без фона и рамки,
занимают ~70 % ячейки, по центру:

| № | Кнопка | Значок |
|---|--------|--------|
| 1 | Удар | короткий меч остриём вверх-вправо, со следом взмаха дугой |
| 2 | Уклонение | силуэт в плаще в рывке + три линии движения |
| 3 | Сдвиг времени | песочные часы, верх — тёплый (прошлое), низ — треснувший (настоящее) |
| 4 | Разлом | разорванное кольцо с искрой в центре |
| 5 | Взаимодействие | открытая ладонь |
| 6 | Эхо | два профиля друг за другом, задний — полупрозрачный |
| 7 | Способность 1 «Искра» | острая искра-звезда о четырёх лучах |
| 8 | Способность 2 «Шов» | стежок-нить, сшивающая трещину |
| 9 | Способность 3 «Тень» | капюшон, наполовину растворённый в дыме |
| 10 | Пауза | две вертикальные полосы с засечками-рунами |
| 11 | Карта/дневник | раскрытая книга с закладкой |
| 12 | запасная ячейка — колокол | маленький колокол |

## Стиль (общий для обоих листов)
- Тёмное готическое фэнтези в духе игры: бронза, старое железо, янтарные руны.
- **Пиксель-арт 32-бит**: чёткие края, ограниченная палитра, без размытия и градиентного «пластика».
- Палитра: чернила #0b0d1a, молоко #ece4cf, янтарь #e0a040 и #ffd27a, бирюза #3ad0c0,
  бронза #b08a3a. Красный #c8284a **не использовать** — в игре он означает опасность.
- Без текста, букв, цифр, водяных знаков, теней на фоне.

## Запрос для Gemini / Grok (лист значков)

```
A clean sprite sheet of 12 game UI icons for a dark gothic fantasy pixel-art game (32-bit era
style), arranged in a 4x3 grid of equal square cells with empty gaps, on a pure black background.
Each icon is a light ivory (#ece4cf) silhouette with a thin dark outline, centered, filling ~70% of
its cell, crisp pixel edges, limited palette, no blur, no text, no letters, no numbers, no frames.
Icons in order (left to right, top to bottom): 1 short sword pointing up-right with an arc swing
trail; 2 hooded figure dashing with three motion lines; 3 hourglass, top half warm amber, bottom
half cracked; 4 broken ring with a spark in the center; 5 open palm hand; 6 two head profiles one
behind the other, the back one translucent; 7 sharp four-pointed spark star; 8 a stitch thread
sewing a crack; 9 a hood dissolving into smoke; 10 pause sign of two vertical bars with small rune
notches; 11 open book with a bookmark; 12 small bell. Accents only in amber (#e0a040) and teal
(#3ad0c0), no red.
```

## Запрос для листа рамок

```
Three game UI button frames for a dark gothic fantasy pixel-art game (32-bit era style), side by
side on a pure black background, equal cells with gaps: 1 a large round bronze ring with tiny
amber runes around it; 2 a medium octagonal frame of old dark iron with bronze corners; 3 a small
round bronze ring. Each frame has an empty dark navy (#0b0d1a) circular center for an icon. Ring
thickness about 10% of the diameter, light from the top left, crisp pixel edges, limited palette
(bronze #b08a3a, amber #e0a040, teal #3ad0c0, ink #0b0d1a), no text, no icons inside, no red.
```

## Как передать
Сохраните листы как `art/inbox/buttons/frames.png` и `art/inbox/buttons/icons.png`
(PNG, лучше с прозрачностью; чёрный фон я уберу сам). Дальше я режу листы, пикселизую под
сетку игры, показываю кнопки на телефоне на согласование и только после «да» ставлю в игру.
