# Пол Затухшего тракта — задание для приложений Gemini и Grok

## Что приложить к запросу

Картинки лежат в папке `art/for-ai/road/` (открыть: `C:\Users\1\Desktop\ash-between-frames\art\for-ai\road`):

1. **`1-layout.png`** — схема комнаты в плоских цветах. Главное: генератор должен повторить
   её раскладку один в один (где небо, балюстрада, дорога, провал, стороны).
2. **`2-style.webp`** — ваш эталонный скриншот: по нему держим стиль, свет и палитру.
3. (по желанию) **`3-current.png`** — как комната выглядит в игре сейчас.

В Gemini (gemini.google.com): «+» → загрузить файлы, выбрать «Создать изображение» / Nano Banana.
В Grok (grok.com): скрепка → загрузить файлы, затем текст запроса. Если Grok не принимает
картинки, используйте запрос из раздела «Без картинки-основы».

## Запрос (скопировать целиком: сначала библия стиля из STYLE.md, потом это)

```
TASK: Paint the FLOOR LAYER of a game level ("The Faded Road") as a single image.

FORMAT
- Portrait, aspect ratio exactly 2:3 (for example 1024×1536). Fill the whole image, edge to edge,
  no borders, no margins, no frame.

USE THE ATTACHED IMAGES
- Image 1 (flat color blocks) is the exact LAYOUT. Keep every region in the same place and the
  same size. Only replace the flat colors with detailed pixel art. Do not move, add or remove regions.
- Image 2 is the STYLE reference: match its pixel-art quality, night lighting, wet stones,
  warm-left / crimson-right color split and mood. Do NOT copy its perspective (it is a perspective
  view) — our image must stay top-down 3/4 orthographic.

LAYOUT (percent of image width W and height H, measured from the top-left corner)
1. Night sky: the top 11% of the image (0–11% H), full width. Deep blue-black sky, a few dark
   clouds, a pale full moon in the upper RIGHT area, distant gothic city silhouette with tiny warm
   windows along the bottom of the sky. On the left the sky has a faint warm amber glow, on the
   right a faint crimson glow.
2. Stone balustrade: a horizontal band 11–13% H across the full width, carved balusters with a
   stone rail, seen from slightly above. In its center (43–57% W) there is an opening: the road
   continues up into a dark gate passage there.
3. Side walls: thin vertical stone walls along the left edge (0–3% W) and the right edge (97–100% W),
   from 13% H down to the bottom. The bottom 2% of the image is a dark stone parapet.
4. The road: a wide straight vertical road of wet cobblestones, from 40% W to 60% W, running from
   the balustrade opening (13% H) all the way down to the bottom. Granite curbs on both edges.
   Puddles on the road reflect warm amber light on the left half and crimson light on the right half.
5. The chasm: a horizontal band of pure black void from 39% H to 48% H across the whole width
   between the side walls (it also cuts the road). Its top and bottom edges are torn and crumbling,
   lit by thin glowing crimson cracks. Inside: only darkness and a few faint crimson specks.
   Do NOT draw a bridge.
6. LEFT side (3–40% W), both above and below the chasm — the warm PAST: dark earth covered with
   fallen orange, amber and rust autumn leaves, dark grass tufts, a few flat stones, leaves piled
   along the left curb of the road, soft warm amber light pools on the ground.
7. RIGHT side BELOW the chasm (60–97% W, 48–98% H): old quiet cemetery ground — dark earth,
   dark olive grass, cold blue moonlight, few leaves.
8. RIGHT side ABOVE the chasm (60–97% W, 13–39% H) — the ERASURE: ash-grey dead ground, glowing
   crimson hairline cracks, missing square chunks of pixels like a corrupted video frame, scattered
   red pixels and broken stones. The erasure also eats into the right edge of the road there:
   a few cobblestones are missing and crimson cracks run across the road.

DO NOT DRAW (the game places these as separate objects on top): trees, lamps, lanterns, banners,
flags, gate towers, the bell, chains, graves, statues, signs, chests, bridge, characters, rain, fog,
any text. The areas where those stand must be plain ground.

QUALITY CHECK BEFORE ANSWERING
- Same layout as image 1? Road straight and centered at 40–60% W? Chasm at 39–48% H? Sky only in the
  top 11%? No objects, no people, no text? Top-down view without perspective? Crisp fine pixel art?
```

## Без картинки-основы (если генератор не принимает изображения)

Тот же запрос, но вместо блока «USE THE ATTACHED IMAGES» вставьте:

```
There is no reference image: follow the LAYOUT percentages below exactly. Style: dark gothic night,
wet stones, warm amber light on the left, crimson erasure glow on the right, high-detail 32-bit pixel art.
```

## Уточнения для следующего раунда (присылать тем же чатом)

- Появились деревья, фонари или люди:
  `Keep everything exactly the same, but remove all trees, lamps, people and objects — leave plain ground there.`
- Появилась перспектива (дорога сужается вдаль):
  `Redraw it strictly top-down orthographic: the road must have the same width at the top and at the bottom, no vanishing point.`
- Дорога или провал сдвинулись:
  `Match the attached layout image exactly: the road from 40% to 60% of the width, the black chasm from 39% to 48% of the height.`
- Слишком размыто, «как картина»:
  `Make it crisp pixel art with small square pixels and hard edges, no blur, no brush strokes.`
- Слишком светло:
  `Make it darker: night, cold blue-black ambient, only the lamplight pools and crimson cracks are bright.`

## Куда положить результат

Сохраните картинки (кнопка «Скачать» / «Download» в приложении) в папку
`C:\Users\1\Desktop\ash-between-frames\art\inbox\road-floor\` с именами
`gemini-1.png`, `gemini-2.png`, `grok-1.png`… (JPG/WebP тоже подойдут) и напишите мне.
Я покажу их рядом с кадром из игры, вы выберете, и только после вашего «да» картинка попадёт в игру.
