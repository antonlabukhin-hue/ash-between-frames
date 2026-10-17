# Пепел между кадрами (ash-between-frames)

Пиксельная action-RPG на Canvas 2D + Vite, без движка. Дизайн-документ — `docs/DESIGN.md`.
Сайт — GitHub Pages (`antonlabukhin-hue/ash-between-frames`), деплой — `.github/workflows/deploy.yml` на push в main.
Общение и коммиты — на русском.

## Карта кода
- `src/main.js` — меню, пауза, настройки, игровой цикл. `src/game.js` — состояние, комнаты, сценарные помощники (`g.say`, `g.choose`, `g.wait`, `g.waitUntil`, `g.spawnWave`).
- `src/timeline/` — система Отпечаток/Шрам (`timeline.js`) и заряды браслета (`charges.js`). Чистые функции.
- `src/combat/` — ритм ударов (`combo.js`), урон (`damage.js`), снаряды с двумя фазами (`projectiles.js`).
- `src/player/`, `src/enemies/` (враги + `boss.js` Брат Мел), `src/world/` (карта, объекты-TimelineProp, свет, частицы).
- `src/scenes/` — комнаты: `chapter1.js`, `finale.js` (босс, выбор, убежище, вылазка), `title.js`, `rooms.js`.
- `src/art/` — палитра, тайлы и спрайты, нарисованные кодом. `src/core/audio.js` — синтез звука и музыки.
- `src/ui/` — HTML-слой (диалоги, меню) и пиксельный HUD; `src/mobile/touch.js` — сенсорное управление.

## Правила
- Логику — в чистые модули с тестом в `tests/unit/`.
- Новые переключаемые объекты описывать данными в `PROP_KINDS` (по фазам), а не вручную.
- Красный не использовать одновременно для здоровья героя, опасности и интерактива: здоровье — молочно-янтарное.
- Работа в ветках `claude/<тема>`, мерж в main через `--no-ff`, один коммит на пункт.
- `gh` CLI нет — репозиторий/Actions через REST API (токен из `git credential fill`).

## Проверка
- `npm run test:unit` — vitest. `npm run test:e2e` — Playwright в Edge (`channel: msedge`).
- В dev-сборке есть `window.__abf` (game, save, ui, input, startGame) и `?room=<id>`.
