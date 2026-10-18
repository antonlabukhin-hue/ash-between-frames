// Чистая функция подбора кадра под физическое разрешение экрана.
export const TARGET_H = 224;
export const LIMITS = { minH: 180, maxH: 248, minW: 320, maxW: 448 };

export function frameSize(devW, devH) {
  const scale = Math.max(1, Math.round(devH / TARGET_H));
  const h = Math.max(LIMITS.minH, Math.min(LIMITS.maxH, Math.floor(devH / scale)));
  const w = Math.max(LIMITS.minW, Math.min(LIMITS.maxW, Math.floor(devW / scale)));
  // чётные размеры — слой света в половинном разрешении без дробей
  return { w: w - (w % 2), h: h - (h % 2), scale };
}
