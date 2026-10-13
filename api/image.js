'use strict';
// Starts a YandexART job (takes 10-40 s) and returns its operation id. The browser then polls this same endpoint with {id}.
// (Merged into one function: the Hobby plan allows 12 functions per deployment.)
const L = require('./_lib');

async function status(req, res) {
  // Polling is cheap and not counted against daily limits, but it still needs the key.
  if (req.method !== 'POST') return L.fail(res, 405, 'method');
  if (!L.configured()) return L.fail(res, 503, 'config', 'AI is not configured yet');
  const b = await L.readBody(req);
  const id = String(b.id || '');
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return L.fail(res, 400, 'id');
  try {
    const d = await L.yfetch(L.HOST() + '/operations/' + id, { method: 'GET' });
    if (!d || !d.done) return L.send(res, 200, { done: false });
    if (d.error) return L.fail(res, 502, 'image', 'The picture was rejected, change the description');
    const img = d.response && d.response.image;
    if (!img) return L.fail(res, 502, 'image', 'No picture came back');
    L.send(res, 200, { done: true, image: 'data:image/jpeg;base64,' + img });
  } catch (e) { L.handleError(res, e); }
}

module.exports = async (req, res) => {
  if (req.method === 'POST') { req.body = await L.readBody(req); if (req.body.id) return status(req, res); }
  const b = await L.guard(req, res, 'image');
  if (!b) return;
  const prompt = L.clip(b.prompt, 500);
  if (prompt.length < 4) return L.fail(res, 400, 'prompt', 'Describe the picture');
  const w = Math.min(Math.max(parseInt(b.w, 10) || 1, 1), 16);
  const h = Math.min(Math.max(parseInt(b.h, 10) || 1, 1), 16);
  const p = L.provider();
  if (p === 'anthropic') return L.fail(res, 503, 'image', 'This AI provider does not draw pictures. Add an OpenAI or Yandex key for pictures.');
  if (p === 'openai') {
    try {
      const size = w > h ? '1536x1024' : w < h ? '1024x1536' : '1024x1024';
      const d = await L.jfetch((process.env.OPENAI_HOST || 'https://api.openai.com') + '/v1/images/generations', {
        method: 'POST', body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size, n: 1, quality: 'low' })
      }, { authorization: 'Bearer ' + process.env.OPENAI_API_KEY });
      const b64 = d && d.data && d.data[0] && d.data[0].b64_json;
      if (!b64) return L.fail(res, 502, 'image', 'No picture came back');
      return L.send(res, 200, { done: true, image: 'data:image/png;base64,' + b64 });
    } catch (e) { return L.handleError(res, e); }
  }
  const model = process.env.YANDEX_ART_MODEL || 'yandex-art/latest';
  try {
    const data = await L.yfetch(L.HOST() + '/foundationModels/v1/imageGenerationAsync', {
      method: 'POST',
      body: JSON.stringify({
        modelUri: 'art://' + L.creds().folder + '/' + model,
        generationOptions: { seed: String(Math.floor(Math.random() * 2e9)), aspectRatio: { widthRatio: String(w), heightRatio: String(h) } },
        messages: [{ weight: '1', text: prompt }]
      })
    });
    if (!data || !data.id) throw new Error('no operation');
    L.send(res, 200, { id: String(data.id) });
  } catch (e) { L.handleError(res, e); }
};
