'use strict';
const L = require('./_lib');

const SYSTEM = (p, name, lg, from, to) => `You are a content strategist for ${name}.
Write all text in ${L.LANG_NAME[lg]}.
Create a content calendar for days ${from} to ${to} of a 30-day launch for the channel the user describes.
Allowed formats (use the id exactly): ${p.formats.map((f) => f.id).join(', ')}.
Rules: mix formats; build a story arc across the month (hook days, proof days, value days, community days, a sale or call-to-action day each week);
every topic must be specific to this channel, never generic; hooks must be real first lines a viewer would see.
Return JSON: {"days":[{"day": number, "topic": "5-9 words", "format": "format id", "hook": "the first line, max 90 characters", "time": "HH:MM local best posting time", "why": "one short sentence, why this post on this day"}]}
Return exactly ${to - from + 1} items, day numbers ${from}..${to}.`;

async function half(p, name, lg, brief, from, to, vc) {
  const j = await L.askJson(SYSTEM(p, name, lg, from, to), 'Channel description from the user:\n' + brief + vc, { temperature: 0.8, maxTokens: 3000 });
  const ids = p.formats.map((f) => f.id);
  const out = [];
  for (const d of Array.isArray(j.days) ? j.days : []) {
    const day = Number(d && d.day);
    if (!(day >= from && day <= to)) continue;
    const time = /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(d.time || '')) ? String(d.time).padStart(5, '0') : '19:00';
    out.push({
      day,
      topic: L.clip(d.topic, 120),
      format: ids.includes(d.format) ? d.format : ids[day % ids.length],
      hook: L.clip(d.hook, 160),
      time,
      why: L.clip(d.why, 200)
    });
  }
  return out.filter((d) => d.topic);
}

module.exports = async (req, res) => {
  const b = await L.guard(req, res, 'plan');
  if (!b) return;
  const brief = L.clip(b.brief, 700);
  if (brief.length < 8) return L.fail(res, 400, 'brief', 'Describe the channel in a sentence');
  const p = L.SPECS.platform(L.clip(b.platform, 20));
  const lg = L.lang(b.lang);
  const name = p.id === 'other' ? L.clip(b.platformName, 40) || 'a social network' : p.name;
  try {
    // Two halves in parallel: one 30-day answer would not fit the model's output budget.
    const [a, c] = await Promise.all([half(p, name, lg, brief, 1, 15, L.voice(b)), half(p, name, lg, brief, 16, 30, L.voice(b))]);
    const byDay = new Map();
    a.concat(c).forEach((d) => { if (!byDay.has(d.day)) byDay.set(d.day, d); });
    const days = Array.from(byDay.values()).sort((x, y) => x.day - y.day);
    if (days.length < 20) return L.fail(res, 502, 'ai', 'AI returned an incomplete plan');
    L.send(res, 200, { days });
  } catch (e) { L.handleError(res, e); }
};
