'use strict';
const L = require('./_lib');

module.exports = async (req, res) => {
  // Polling is cheap and not counted against daily limits, but it still needs the key.
  if (req.method !== 'POST') return L.fail(res, 405, 'method');
  if (!L.creds()) return L.fail(res, 503, 'config', 'AI is not configured yet');
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
};
