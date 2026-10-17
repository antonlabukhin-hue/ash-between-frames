// Все комнаты игры по id.
import { road, tornRoad, camp, square, stairs, shadowArena, ascent } from './chapter1.js';
import { belfry, under, kitchen, ruins } from './finale.js';

export const ROOMS = { road, tornRoad, camp, square, stairs, shadowArena, ascent, belfry, under, kitchen, ruins };

// Порядок главы — для меню отладки и проверки целостности.
export const CHAPTER1 = ['road', 'tornRoad', 'camp', 'square', 'stairs', 'shadowArena', 'ascent', 'belfry', 'under', 'kitchen'];
