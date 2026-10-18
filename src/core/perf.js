// Замеры кадра и отладочный оверлей (F3 или ?debug).

export function createPerf() {
  return {
    on: false, el: null, calls: 0, lastCalls: 0, patched: false,
    upd: new Float32Array(120), ren: new Float32Array(120), gap: new Float32Array(120), i: 0,
    lastShow: 0, info: {},
  };
}

// Счётчик вызовов отрисовки на основном холсте.
export function instrument(perf, ctx) {
  if (perf.patched) return;
  perf.patched = true;
  for (const m of ['fillRect', 'drawImage', 'fillText', 'putImageData', 'clearRect']) {
    const orig = ctx[m];
    ctx[m] = function (...a) {
      perf.calls++;
      return orig.apply(this, a);
    };
  }
}

export function recordFrame(perf, updMs, renMs, gapMs) {
  perf.upd[perf.i] = updMs;
  perf.ren[perf.i] = renMs;
  perf.gap[perf.i] = gapMs;
  perf.i = (perf.i + 1) % perf.upd.length;
  perf.lastCalls = perf.calls;
  perf.calls = 0;
}

const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const max = (a) => a.reduce((m, v) => (v > m ? v : m), 0);

export function summary(perf) {
  const gap = avg(perf.gap);
  return {
    fps: gap > 0 ? 1000 / gap : 0,
    frameMs: gap,
    frameMax: max(perf.gap),
    updMs: avg(perf.upd),
    renMs: avg(perf.ren),
    cpuMs: avg(perf.upd) + avg(perf.ren),
    calls: perf.lastCalls,
  };
}

export function setOverlay(perf, on) {
  perf.on = on;
  if (!perf.el) {
    perf.el = document.createElement('pre');
    perf.el.className = 'perf';
    document.body.appendChild(perf.el);
  }
  perf.el.style.display = on ? 'block' : 'none';
}

const mb = (b) => (b / 1048576).toFixed(1);

// Обновляем текст не чаще 4 раз в секунду.
export function showOverlay(perf, now, data) {
  if (!perf.on || now - perf.lastShow < 250) return;
  perf.lastShow = now;
  const s = summary(perf);
  const heap = performance.memory ? `${mb(performance.memory.usedJSHeapSize)} МБ` : 'н/д';
  perf.el.textContent = [
    `FPS        ${s.fps.toFixed(0)}  (${data.fpsCap} цель)`,
    `кадр       ${s.frameMs.toFixed(1)} мс  макс ${s.frameMax.toFixed(1)}`,
    `логика     ${s.updMs.toFixed(2)} мс`,
    `отрисовка  ${s.renMs.toFixed(2)} мс`,
    `вызовы     ${s.calls}  (лимит ${data.callLimit})`,
    `объекты    ${data.objects}`,
    `частицы    ${data.particles}/${data.particleCap}`,
    `свет       ${data.lights}/${data.lightLimit}`,
    `враги      ${data.enemies} (далеко ${data.far})`,
    `память JS  ${heap}`,
    `холсты     ${mb(data.canvasBytes)} МБ  атлас ${data.atlasFrames} кадр.`,
    `профиль    ${data.profile}  ${data.frame}`,
  ].join('\n');
}
