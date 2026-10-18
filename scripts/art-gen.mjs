// Генерация вариантов арта через API: node scripts/art-gen.mjs <провайдер> <задание> [--n 2] [--ref файл.png] [--aspect 2:3]
//   провайдер: gemini | grok | all
//   задание:   art/prompts/<имя>.md (текст запроса) — результат в art/inbox/<имя>/<провайдер>-<n>.png
// Ключи — в .env.local (не попадает в git): GEMINI_API_KEY, XAI_API_KEY.
// Модели можно сменить: GEMINI_IMAGE_MODEL, XAI_IMAGE_MODEL.
// Картинки ничего не меняют в игре: сначала согласование, потом scripts/art-approve.mjs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const env = {};
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const key = (k) => process.env[k] || env[k];

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const provider = args[0];
const job = args[1];
if (!provider || !job) {
  console.log('node scripts/art-gen.mjs <gemini|grok|all> art/prompts/<задание>.md [--n 2] [--ref файл.png] [--aspect 2:3]');
  process.exit(1);
}
const prompt = readFileSync(job, 'utf8');
const n = Number(opt('n', 2));
const aspect = opt('aspect', '2:3');
const ref = opt('ref', null);
const name = basename(job).replace(/\.\w+$/, '');
const dir = `art/inbox/${name}`;
mkdirSync(dir, { recursive: true });

// Найти в ответе картинку: base64 в data / b64_json / inlineData или ссылку url.
function findImages(o, out = []) {
  if (!o || typeof o !== 'object') return out;
  if (Array.isArray(o)) {
    o.forEach((v) => findImages(v, out));
    return out;
  }
  if (typeof o.b64_json === 'string') out.push({ b64: o.b64_json });
  if (o.inlineData?.data) out.push({ b64: o.inlineData.data });
  if (typeof o.data === 'string' && o.data.length > 1000 && /image/.test(o.mime_type || o.mimeType || 'image')) out.push({ b64: o.data });
  if (typeof o.url === 'string' && /^https?:/.test(o.url)) out.push({ url: o.url });
  for (const v of Object.values(o)) if (v && typeof v === 'object') findImages(v, out);
  return out;
}

async function save(img, file) {
  const buf = img.b64 ? Buffer.from(img.b64, 'base64') : Buffer.from(await (await fetch(img.url)).arrayBuffer());
  writeFileSync(file, buf);
  return file;
}

async function gemini(i) {
  const k = key('GEMINI_API_KEY');
  if (!k) throw new Error('нет GEMINI_API_KEY в .env.local');
  const model = key('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image';
  const parts = [{ text: prompt }];
  if (ref) parts.push({ inlineData: { mimeType: 'image/png', data: readFileSync(ref).toString('base64') } });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } } }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  const imgs = findImages(json);
  if (!imgs.length) throw new Error(`Gemini не вернул картинку: ${JSON.stringify(json).slice(0, 300)}`);
  return save(imgs[imgs.length - 1], `${dir}/gemini-${i}.png`);
}

async function grok(i) {
  const k = key('XAI_API_KEY');
  if (!k) throw new Error('нет XAI_API_KEY в .env.local');
  const model = key('XAI_IMAGE_MODEL') || 'grok-imagine-image';
  const res = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
    body: JSON.stringify({ model, prompt, n: 1, response_format: 'b64_json' }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Grok ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  const imgs = findImages(json);
  if (!imgs.length) throw new Error(`Grok не вернул картинку: ${JSON.stringify(json).slice(0, 300)}`);
  return save(imgs[0], `${dir}/grok-${i}.png`);
}

const list = provider === 'all' ? ['gemini', 'grok'] : [provider];
const fns = { gemini, grok };
const done = [];
for (const p of list) {
  for (let i = 1; i <= n; i++) {
    try {
      done.push(await fns[p](i));
      console.log('готово:', done[done.length - 1]);
    } catch (e) {
      console.log(`${p} #${i}: ${e.message}`);
    }
  }
}
writeFileSync(`${dir}/meta.json`, JSON.stringify({ job, prompt, ref, aspect, files: done, at: new Date().toISOString() }, null, 2));
