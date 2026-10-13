'use strict';
// Starts a YandexART job (takes 10-40 s) and returns its operation id; the browser polls /api/image-status.
const L = require('./_lib');

module.exports = async (req, res) => {
  const b = await L.guard(req, res, 'image');
  if (!b) return;
  const prompt = L.clip(b.prompt, 500);
  if (prompt.length < 4) return L.fail(res, 400, 'prompt', 'Describe the picture');
  const w = Math.min(Math.max(parseInt(b.w, 10) || 1, 1), 16);
  const h = Math.min(Math.max(parseInt(b.h, 10) || 1, 1), 16);
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
