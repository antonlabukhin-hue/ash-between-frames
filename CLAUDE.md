# Пепел между кадрами (ash-between-frames)

Пиксельная action-RPG на Canvas 2D + Vite, без движка, в 32-битном стиле. Дизайн-документ — `docs/DESIGN.md`, арт — `docs/ART_TECH_SPEC.md`.
Сайт — GitHub Pages (`antonlabukhin-hue/ash-between-frames`), деплой — `.github/workflows/deploy.yml` на push в main.
Общение и коммиты — на русском.

## Карта кода
- `src/main.js` — меню, пауза, настройки, игровой цикл. `src/game.js` — состояние, комнаты, сценарные помощники (`g.say`, `g.choose`, `g.wait`, `g.waitUntil`, `g.spawnWave`).
- `src/timeline/` — система Отпечаток/Шрам (`timeline.js`) и заряды браслета (`charges.js`). Чистые функции.
- `src/combat/` — ритм ударов (`combo.js`), урон (`damage.js`), снаряды с двумя фазами (`projectiles.js`).
- `src/player/`, `src/enemies/` (враги + `boss.js` Брат Мел), `src/world/` (карта, объекты-TimelineProp, свет, частицы).
- `src/scenes/` — комнаты: `chapter1.js`, `finale.js` (босс, выбор, убежище, вылазка), `title.js`, `rooms.js`.
- `src/art/` — палитра, тайлы и спрайты, нарисованные кодом. 32-битная сетка: `core/frame.js` (RS), `hd.js` (HD-маляры, пикселизация), `upscale.js` (Scale2x), `hero32.js`, `enemies32.js`, `tiles32.js`, `road32.js` (эталон), `glow.js` + `atmo.js` (свет, дождь, туман, отражения). `src/core/audio.js` — синтез звука и музыки.
- `src/ui/` — HTML-слой (диалоги, меню) и пиксельный HUD; `src/mobile/touch.js` — сенсорное управление.

## Правила
- Логику — в чистые модули с тестом в `tests/unit/`.
- Новые переключаемые объекты описывать данными в `PROP_KINDS` (по фазам), а не вручную.
- Красный не использовать одновременно для здоровья героя, опасности и интерактива: здоровье — молочно-янтарное.
- Выбор и взаимодействие — подсветкой самого объекта и табличкой над ним, без маркеров на земле; шрифты — Alegreya SC/Sans, пиксельный только крупно (docs/UI_READABILITY.md).
- Рисованные слои комнат — через конвейер docs/ART_PIPELINE.md (шаблон → генерация → согласование с пользователем → art-approve); без согласования в игру не добавлять.
- Новые спрайты — HD-малярами в плотной сетке (`opts.hd`, `crisp`), погода и свет комнаты — данными (`def.weather`, `lightColor`, `lightY`, `def.lights`).
- Работа в ветках `claude/<тема>`, мерж в main через `--no-ff`, один коммит на пункт.
- `gh` CLI нет — репозиторий/Actions через REST API (токен из `git credential fill`).

## Проверка
- `npm run test:unit` — vitest. `npm run test:e2e` — Playwright в Edge (`channel: msedge`).
- В dev-сборке есть `window.__abf` (game, save, ui, input, startGame) и `?room=<id>`.
- `node scripts/shots32.mjs <стадия>` — контрольные кадры прямо с холста (нужен dev-сервер).
