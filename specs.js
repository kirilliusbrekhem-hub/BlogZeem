/* Shared platform specs: used by the browser (global BS_SPECS) and by api/* (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BS_SPECS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // kind: text | image | carousel | video | thread
  function f(id, kind, ru, en) { return { id: id, kind: kind, ru: ru, en: en }; }

  var PLATFORMS = [
    { id: 'instagram', name: 'Instagram', color: '#E1306C', ratio: [4, 5], limit: 2200, bio: 150, tags: 5,
      formats: [f('reel', 'video', 'Рилс', 'Reel'), f('carousel', 'carousel', 'Карусель', 'Carousel'), f('post', 'image', 'Пост', 'Post'), f('story', 'video', 'Сторис', 'Story')] },
    { id: 'tiktok', name: 'TikTok', color: '#111111', ratio: [9, 16], limit: 2200, bio: 80, tags: 5,
      formats: [f('video', 'video', 'Видео', 'Video'), f('photos', 'carousel', 'Фото-карусель', 'Photo carousel')] },
    { id: 'youtube', name: 'YouTube', color: '#FF0000', ratio: [16, 9], limit: 5000, bio: 1000, tags: 3,
      formats: [f('short', 'video', 'Шортс', 'Short'), f('video', 'video', 'Видео', 'Video'), f('community', 'image', 'Сообщество', 'Community post')] },
    { id: 'vk', name: 'VK', color: '#0077FF', ratio: [1, 1], limit: 8000, bio: 140, tags: 5,
      formats: [f('post', 'image', 'Пост', 'Post'), f('clip', 'video', 'Клип', 'Clip'), f('article', 'text', 'Статья', 'Article'), f('story', 'video', 'История', 'Story')] },
    { id: 'telegram', name: 'Telegram', color: '#27A7E7', ratio: [16, 9], limit: 4096, bio: 255, tags: 3,
      formats: [f('post', 'image', 'Пост', 'Post'), f('longread', 'text', 'Лонгрид', 'Longread'), f('poll', 'text', 'Опрос', 'Poll'), f('circle', 'video', 'Кружок', 'Video note')] },
    { id: 'dzen', name: 'Дзен', color: '#1A1A1A', ratio: [16, 9], limit: 20000, bio: 200, tags: 0,
      formats: [f('article', 'text', 'Статья', 'Article'), f('short', 'video', 'Ролик', 'Short video'), f('post', 'image', 'Пост', 'Post')] },
    { id: 'x', name: 'X', color: '#000000', ratio: [16, 9], limit: 280, bio: 160, tags: 2,
      formats: [f('tweet', 'text', 'Твит', 'Post'), f('thread', 'thread', 'Тред', 'Thread')] },
    { id: 'threads', name: 'Threads', color: '#000000', ratio: [1, 1], limit: 500, bio: 150, tags: 1,
      formats: [f('post', 'text', 'Пост', 'Post'), f('thread', 'thread', 'Цепочка', 'Chain')] },
    { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', ratio: [1, 1], limit: 3000, bio: 2600, tags: 3,
      formats: [f('post', 'text', 'Пост', 'Post'), f('carousel', 'carousel', 'Карусель (PDF)', 'Carousel'), f('article', 'text', 'Статья', 'Article')] },
    { id: 'facebook', name: 'Facebook', color: '#1877F2', ratio: [1, 1], limit: 5000, bio: 101, tags: 3,
      formats: [f('post', 'image', 'Пост', 'Post'), f('reel', 'video', 'Рилс', 'Reel')] },
    { id: 'pinterest', name: 'Pinterest', color: '#E60023', ratio: [2, 3], limit: 500, bio: 160, tags: 5,
      formats: [f('pin', 'image', 'Пин', 'Pin'), f('idea', 'carousel', 'Идея-пин', 'Idea pin')] },
    { id: 'other', name: 'Other', color: '#6B5CFF', ratio: [1, 1], limit: 2000, bio: 150, tags: 3,
      formats: [f('post', 'image', 'Пост', 'Post'), f('video', 'video', 'Видео', 'Video'), f('text', 'text', 'Текст', 'Text')] }
  ];

  var byId = {};
  PLATFORMS.forEach(function (p) { byId[p.id] = p; });

  function platform(id) { return byId[id] || byId.other; }
  function format(pid, fid) {
    var p = platform(pid);
    for (var i = 0; i < p.formats.length; i++) if (p.formats[i].id === fid) return p.formats[i];
    return p.formats[0];
  }

  return { PLATFORMS: PLATFORMS, platform: platform, format: format };
});
