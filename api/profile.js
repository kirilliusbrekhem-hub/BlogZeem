'use strict';
const L = require('./_lib');

const SYSTEM = (p, lg) => `You are a senior social media strategist who sets up accounts that convert visitors into followers in the first 3 seconds.
Write all text in ${L.LANG_NAME[lg]}.
Platform: ${p.name}. Bio limit: ${p.bio} characters. Account setup must follow the real conventions of ${p.name}.
Be specific to the channel described by the user, never generic. No hashtags spam, no empty superlatives.
Return JSON with exactly these keys:
{
 "names": [3 display names, short, memorable],
 "handles": [5 username ideas, latin letters, digits, underscore or dot only, no @],
 "bio": [3 bio variants, each at most ${p.bio} characters, each with a different angle: what you give / who it is for / proof or personality],
 "tagline": "one line of at most 60 characters for the profile header or channel description",
 "link_in_bio": {"title": "short title", "items": [3 to 5 link button labels in the order that converts best]},
 "sections": [4 to 6 objects {"title": "name of a highlight / playlist / board / category", "idea": "what goes there, one sentence"}],
 "pinned": [3 objects {"title": "pinned post or video title", "idea": "what it says and why it is pinned, one sentence"}],
 "avatar_prompt": "English prompt for an image generator: a clean avatar for this channel, no text, no letters",
 "banner_prompt": "English prompt for an image generator: a wide banner or cover for this channel, no text, no letters",
 "first_week": [7 short action steps for the first 7 days after setup],
 "rhythm": "how often to post and what to do daily, two sentences"
}`;

module.exports = async (req, res) => {
  const b = await L.guard(req, res, 'profile');
  if (!b) return;
  const brief = L.clip(b.brief, 700);
  if (brief.length < 8) return L.fail(res, 400, 'brief', 'Describe the channel in a sentence');
  const p = L.SPECS.platform(L.clip(b.platform, 20));
  const lg = L.lang(b.lang);
  const name = p.id === 'other' ? L.clip(b.platformName, 40) || 'a social network' : p.name;
  const spec = Object.assign({}, p, { name });
  try {
    const j = await L.askJson(SYSTEM(spec, lg), 'Channel description from the user:\n' + brief + L.voice(b), { temperature: 0.8, maxTokens: 2200 });
    const bio = L.strs(j.bio, 3, p.bio);
    if (!bio.length) throw new Error('bio');
    const items = L.strs(j.link_in_bio && j.link_in_bio.items, 5, 40);
    const objs = (a, n) => (Array.isArray(a) ? a : []).map((x) => ({ title: L.clip(x && x.title, 60), idea: L.clip(x && x.idea, 220) })).filter((x) => x.title).slice(0, n);
    L.send(res, 200, {
      names: L.strs(j.names, 3, 50),
      handles: L.strs(j.handles, 5, 30).map((h) => h.replace(/^@/, '').replace(/[^A-Za-z0-9_.]/g, '')).filter(Boolean),
      bio,
      tagline: L.clip(j.tagline, 80),
      link_in_bio: { title: L.clip(j.link_in_bio && j.link_in_bio.title, 60), items },
      sections: objs(j.sections, 6),
      pinned: objs(j.pinned, 3),
      avatar_prompt: L.clip(j.avatar_prompt, 400),
      banner_prompt: L.clip(j.banner_prompt, 400),
      first_week: L.strs(j.first_week, 7, 160),
      rhythm: L.clip(j.rhythm, 300)
    });
  } catch (e) { L.handleError(res, e); }
};
