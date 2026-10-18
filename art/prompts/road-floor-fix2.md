# Вариант 3 (пол тракта): композиция варианта 2 + стиль варианта 1

Вариант 2 правильно держит проекцию (стена с аркой, без горизонта), но потерял пиксельный стиль
и раскол «тёплое слева / Стирание справа». Вариант 1 — наоборот. Склеиваем лучшее из обоих.
Пропорции по высоте больше не подгоняем: после выбора картинки Claude подстроит карту комнаты под неё.

Приложить в том же чате Gemini (в таком порядке):
1. `art/inbox/road-floor/variant-2.jpg` — композиция;
2. `art/inbox/road-floor/variant-1.jpg` — стиль;
3. `art/for-ai/road/2-style.webp` — эталон настроения.

```
Redraw IMAGE 1 in the art style of IMAGE 2.

KEEP FROM IMAGE 1 (composition, exactly): the city wall facade with battlements, the two square
towers, the arch gate with the lowered portcullis, the straight road position and width, the black
chasm band across the map and its height, the stone parapet blocks at the bottom. Same single
top-down 3/4 orthographic projection, no horizon, only a thin strip of night sky above the wall.

TAKE FROM IMAGE 2 (style and color):
- Crisp high-detail pixel art with small square pixels, hard edges and dithering — NOT a smooth
  painted or airbrushed illustration.
- Warm / crimson split: the LEFT half of the map is the warm past — golden-orange fallen leaves,
  amber lamplight pools on the ground, warm reflections in puddles on the left half of the road.
  The RIGHT half is cold and erased — crimson glow, crimson reflections on the right half of the road.
- Above the chasm on the RIGHT side the ground is ERASED like in image 2: ash-grey cracked dead
  ground, glowing crimson hairline cracks, missing square chunks of pixels like a corrupted video
  frame, scattered red pixels; the erasure also eats a few stones at the right edge of the road.
- Wet rainy night: cobblestones with small cold-blue specular highlights, dark puddles with thin
  light edges.
- Darker overall: night, cold blue-black ambient, only the light pools, puddle reflections and
  crimson cracks are bright. The sky strip is dark blue-black, no colorful nebula.

DO NOT DRAW: trees, lamps, banners, the bell, gravestones, statues, signs, chests, a bridge,
characters, rain streaks, fog, text, borders. Same 2:3 portrait format.
```
