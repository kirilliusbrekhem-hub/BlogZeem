# BlogSeem

AI studio for creators: account setup, 30-day plan, posts, images and video for any social network, plus an AI editor.

## Deploy (Vercel)
1. Import this folder as a project (framework: Other, no build command).
2. Add environment variables: `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`. Optional: `YANDEX_MODEL` (default `yandexgpt/latest`), `YANDEX_ART_MODEL` (default `yandex-art/latest`).
3. In Yandex Cloud the service account needs roles `ai.languageModels.user` and `ai.imageGeneration.user`. Set a budget limit in billing: that is the real spend guard.
4. Optional limits per IP per day: `PROFILE_PER_DAY` 6, `PLAN_PER_DAY` 4, `POST_PER_DAY` 60, `IMPROVE_PER_DAY` 80, `IMAGE_PER_DAY` 8, `AUDIT_PER_DAY` 6, `TRENDS_PER_DAY` 10, `HOOKS_PER_DAY` 40.
5. X-Ray reads public Telegram channels from `t.me/s/<name>`; Trend Radar reads Google News RSS. Both are fetched by the serverless function, so check them once after deploy.

## Files
`index.html style.css` page and design · `core.js studio.js tools.js editor.js landing.js video.js` app · `i18n.js` RU/EN texts · `specs.js` platform limits (shared by browser and API) · `api/*.js` serverless functions · `logo.svg icon.svg` brand.


## AI provider
Set one key in Vercel env vars: `GROQ_API_KEY` (text, free tier), `ANTHROPIC_API_KEY` (text), `OPENAI_API_KEY` (text and pictures) or `YANDEX_API_KEY` + `YANDEX_FOLDER_ID`. `AI_PROVIDER` forces a choice when several are set. With no key the site runs and the AI parts say they are not connected yet.
