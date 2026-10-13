'use strict';
const L = require('./_lib');

const KIND_RULES = {
  video: 'It is a short video. "beats" are 4 to 7 scenes. For each: "say" = the voiceover line, "text" = the on-screen subtitle (max 7 words, punchy), "show" = what the viewer sees (English, concrete, for an image generator, no text in the picture).',
  carousel: 'It is a swipe carousel. "beats" are 5 to 9 slides: slide 1 is the hook, the last slide is the call to action. For each: "text" = the slide headline (max 8 words), "say" = 1 to 2 supporting sentences, "show" = the slide visual (English, concrete, no text in the picture).',
  thread: 'It is a thread. "beats" are 4 to 8 posts of the thread: first one is the hook. For each: "text" = the full text of that post, "say" = "", "show" = "". Respect the character limit for each post.',
  image: 'It is a single image post. "beats" must be an empty array.',
  text: 'It is a text post. "beats" must be an empty array.'
};

const SYSTEM = (p, name, f, lg, tone) => `You are a ghostwriter who writes posts people save and share, for ${name}.
Write all text in ${L.LANG_NAME[lg]} (the "show" and "image_prompt" fields are always in English).
Format: ${f.id} (${f.kind}). ${KIND_RULES[f.kind]}
Caption character limit: ${p.limit}. Hashtags: at most ${p.tags}, relevant, no generic ones like #love.
Tone: ${tone}. Write like a person, not like marketing copy. First line must stop the scroll. Finish with one clear call to action.
No invented statistics, no fake testimonials, no claims that could be false.
Return JSON: {"title":"working title","caption":"the full ready-to-publish text","beats":[{"text":"","say":"","show":""}],"tags":["without #"],"cta":"the call to action as one line","cover_text":"max 6 words for the cover","image_prompt":"English prompt for a cover image, concrete scene, style and light, no text or letters in the image"}`;

const TONES = { playful: 'playful, witty, light', expert: 'confident, expert, precise', plain: 'plain, warm, simple words', bold: 'bold, direct, provocative but fair' };

module.exports = async (req, res) => {
  const b = await L.guard(req, res, 'post');
  if (!b) return;
  const brief = L.clip(b.brief, 700);
  const topic = L.clip(b.topic, 200);
  if (brief.length < 8 || !topic) return L.fail(res, 400, 'input', 'Channel and topic are required');
  const p = L.SPECS.platform(L.clip(b.platform, 20));
  const f = L.SPECS.format(p.id, L.clip(b.format, 20));
  const lg = L.lang(b.lang);
  const name = p.id === 'other' ? L.clip(b.platformName, 40) || 'a social network' : p.name;
  const tone = TONES[b.tone] || TONES.plain;
  const user = 'Channel description from the user:\n' + brief + '\n\nPost topic: ' + topic + (b.hook ? '\nSuggested first line: ' + L.clip(b.hook, 160) : '') + L.voice(b);
  try {
    const j = await L.askJson(SYSTEM(p, name, f, lg, tone), user, { temperature: 0.8, maxTokens: 2800 });
    const caption = L.clip(j.caption, p.limit);
    if (caption.length < 10) throw new Error('caption');
    const beats = (f.kind === 'text' || f.kind === 'image' ? [] : Array.isArray(j.beats) ? j.beats : [])
      .map((x) => ({ text: L.clip(x && x.text, f.kind === 'thread' ? Math.min(p.limit, 500) : 120), say: L.clip(x && x.say, 300), show: L.clip(x && x.show, 240) }))
      .filter((x) => x.text).slice(0, 10);
    L.send(res, 200, {
      title: L.clip(j.title, 120) || topic,
      caption,
      beats,
      tags: L.strs(j.tags, p.tags, 30).map((t) => t.replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean),
      cta: L.clip(j.cta, 160),
      cover_text: L.clip(j.cover_text, 60),
      image_prompt: L.clip(j.image_prompt, 400)
    });
  } catch (e) { L.handleError(res, e); }
};
