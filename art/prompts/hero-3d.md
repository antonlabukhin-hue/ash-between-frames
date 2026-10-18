# Рен в 3D: запросы для модели героя

Путь: **концепт (Gemini) → 3D-модель (Meshy / Tripo / Rodin / Hunyuan3D) → кости и анимации
(Mixamo) → файлы Claude** → спрайты всех анимаций → согласование → в игру.

Картинки для приложения — в `art/for-ai/hero/`:
- `1-hero-reference.png` — Рен с эталонного скриншота крупно (вид со спины);
- `2-game-sprites.png` — нынешний Рен в игре (развороты), для узнаваемости.

---

## Шаг 1. Концепт героя в Gemini (лист разворотов)

Генераторы 3D строят модель по одной чистой картинке в полный рост — не по сцене.
Приложить `1-hero-reference.png` и `2-game-sprites.png`, затем:

```
Create a CHARACTER TURNAROUND SHEET for a 3D model of this hero (attached: image 1 is the hero
seen from behind in a pixel-art scene, image 2 shows the same hero as small game sprites).

CHARACTER: Ren, "the Last Keeper" — a slim young wanderer of a dark gothic fantasy world.
- A deep navy-blue hooded cloak: pointed hood that hides the face, a short shoulder cape/shawl,
  and a cloak that falls to the knees with a slightly ragged hem.
- Under the hood the face is a smooth mask of black glass with two small glowing teal eyes.
- A muted steel-blue tunic to mid-thigh, a brown leather belt with a small brass buckle and a
  small leather pouch on the left hip.
- Dark blue-grey trousers, brown leather boots to mid-calf with a folded top.
- A brown leather gauntlet/bracer on the RIGHT forearm; on the LEFT wrist a dark bracelet with
  four small gems (three teal, one amber).
- Small amber sun emblem (a circle with rays) embroidered on the back of the cloak, between the
  shoulder blades.
- Body proportions: realistic-heroic, about 6.5 heads tall, NOT chibi, not muscular.

POSE AND LAYOUT
- Show the same character three times side by side: FRONT view, SIDE view (facing right),
  BACK view. Full body, head to boots fully visible, same scale, same height.
- Neutral A-POSE: arms straight and slightly away from the body (about 30–40° down from
  horizontal), palms facing the thighs, fingers together, legs straight and slightly apart,
  feet flat. The hood is up. The cloak hangs straight and does not cover the arms or legs.
- NO weapon in the hands (the sword is a separate object, see below).
- Plain flat light-grey background, even soft studio lighting, no shadows on the ground,
  no scene, no text, no labels, no frames.

STYLE
- Clean stylized 3D-game concept art: clear shapes, flat readable colors, simple hand-painted
  texture look, no tiny ornaments, no photo textures, no strong baked highlights.
- Colors: navy blue #34508A cloak, steel blue #5F7392 tunic, brown #6A4428 leather,
  #4A2E1A boots, black glass mask, teal #6FF2E0 eyes.
```

Если поза получилась не A-поза — уточнение в том же чате:
`Same character, but strictly in a neutral A-pose: arms straight, 35° away from the body, legs slightly apart, no weapon, full body, plain grey background.`

Для генератора 3D нужен один **вид спереди** — вырежьте его из листа (или попросите Gemini:
`Show only the FRONT view, full body, centered, plain grey background.`).

## Шаг 2. 3D-модель (Meshy, Tripo, Rodin или Hunyuan3D)

**Image to 3D** — загрузить вид спереди. Если сервис просит текст или вариант «Text to 3D»:

```
Stylized game character, full body, neutral A-pose, hooded wanderer: deep navy-blue pointed hood
covering the face with a smooth black glass mask and two small teal glowing eyes, short shoulder
cape and knee-length navy cloak with a slightly ragged hem, muted steel-blue tunic to mid-thigh,
brown leather belt with brass buckle and a pouch, dark blue-grey trousers, brown leather boots,
brown leather bracer on the right forearm, dark bracelet with four gems on the left wrist,
small amber sun emblem on the back. Slim, about 6.5 heads tall, symmetrical, arms away from the
body, no weapon, hand-painted stylized textures, flat readable colors, no baked lighting.
```

Настройки (названия в сервисах немного отличаются):
- поза: **A-pose / T-pose**, симметрия: **включена**;
- полигонов: **15–30 тысяч** (low/medium poly), топология — quad, если есть выбор;
- текстура: stylized / hand-painted, **без запечённого освещения** (no baked lighting / PBR — базовый цвет);
- экспорт: **FBX** (для Mixamo) и **GLB** (для меня).

Если у сервиса есть кнопка **Auto-rig / Animate** — можно сразу ей (Meshy и Tripo умеют), тогда
Mixamo не нужен: выберите анимации из списка шага 4 и скачайте GLB с анимациями.

## Шаг 3. Меч (отдельной моделью)

```
Stylized one-handed fantasy longsword for a game character: straight steel blade with a central
fuller, simple brass crossguard, dark brown leather-wrapped grip, small round brass pommel.
Total length about the height of the character's leg. Hand-painted stylized texture,
no baked lighting, plain background.
```

## Шаг 4. Кости и анимации в Mixamo (mixamo.com, бесплатно, вход через Adobe ID)

1. **Upload Character** → загрузить FBX героя → расставить метки (подбородок, запястья, локти,
   колени, пах) → Skeleton LOD: **Standard** → Next.
2. Выбрать анимации (поиск по названию; подойдут и похожие) и скачать каждую:
   - покой: `Sword And Shield Idle` (или `Idle`);
   - ходьба: `Sword And Shield Walk` (или `Walking`) — включить **In Place**;
   - бег: `Sword And Shield Run` — **In Place**;
   - три удара разной формы: `Sword And Shield Slash` (два разных), `Sword And Shield Attack`;
   - уклонение: `Stand To Roll` (или `Sprinting Forward Roll`) — **In Place**;
   - получение урона: `Sword And Shield Impact` (или `Hit Reaction`);
   - смерть: `Sword And Shield Death` (или `Dying`);
   - сдвиг времени (жест рукой): `Standing 1H Magic Attack 01` (или `Magic Spell Casting`).
3. Настройки скачивания: Format **FBX Binary**, **30 fps**, Keyframe Reduction — none.
   Первую анимацию — **With Skin**, остальные можно **Without Skin**.

## Шаг 5. Файлы — мне

Положите всё в `C:\Users\1\Desktop\ash-between-frames\art\inbox\hero3d\`:
модель (GLB/FBX), меч, анимации (FBX) — имена файлов любые, лучше как в Mixamo.
Дальше я: подключаю модель, ставлю камеру под углом игры, снимаю все анимации по направлениям,
пикселизую под стиль игры и показываю лист кадров на согласование.
