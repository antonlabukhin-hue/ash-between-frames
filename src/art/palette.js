// Палитра. Янтарь — прошлое и живые воспоминания, малиновый — Стирание и опасность,
// бирюза — обычная магия, молочно-белый — редкие сюжетные проявления.
// Здоровье героя — молочно-янтарное, здоровье врагов — пепельное, опасность — малиновая:
// одинаковым красным не пользуемся.
export const P = {
  void: '#05060c',
  ink: '#0b0d1a',
  night: '#121628',
  navy: '#1c2440',
  slate: '#2a3150',
  blue: '#34507f',
  blueHi: '#5374a8',
  blueLo: '#24365a',
  ash0: '#24252e',
  ash1: '#3a3b47',
  ash2: '#55576a',
  ash3: '#7e8193',
  ash4: '#aeb0bc',
  milk: '#ece4cf',
  amber0: '#7a4a18',
  amber1: '#b8721f',
  amber: '#e0a040',
  amberHi: '#ffd27a',
  crimson0: '#4a0c1e',
  crimson1: '#86163a',
  crimson: '#c8284a',
  crimsonHi: '#ff5a7a',
  teal0: '#145a5a',
  teal: '#3ad0c0',
  tealHi: '#a8fff0',
  leaf: '#a86a1c',
  leafHi: '#d89a34',
  moss: '#3b4a2a',
  stone0: '#1d1f2a',
  stone1: '#2c2f3d',
  stone2: '#3d4152',
  stone3: '#555a6e',
  brass: '#b08a3a',
  brassHi: '#e6c06a',
  skin: '#c9a88a',
  wood: '#4a3424',
  woodHi: '#6e4e34',
};

// Оттенок фазы для подсветки объектов.
export const PHASE_COLOR = { past: P.amber, present: P.crimson };
export const PHASE_HI = { past: P.amberHi, present: P.crimsonHi };
