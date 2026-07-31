# SastaGram — Next-Level Features Roadmap

Sequential build order. Status: ✅ done · 🔨 in progress · ⬜ pending

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | AI caption suggestions (Gemini Vision) | ✅ | ✨ button in CreatePost, 3 styles |
| 2 | Stories (24h TTL, seen-by ring) | ⬜ | Mongo TTL index |
| 3 | Semantic photo search | ⬜ | Atlas Vector Search over caption+image description |
| 4 | Auto alt-text | ⬜ | Background Gemini description on upload |
| 5 | AI comment moderation | ⬜ | Soft-block toxic comments |
| 6 | Share post to DM | ⬜ | Post bubble in chat |
| 7 | Polls on posts | ⬜ | Realtime votes via socket |
| 8 | Last-active status in DMs | ⬜ | "Active 5m ago" |
| 9 | Web push notifications | ⬜ | Service worker + VAPID |
| 10 | Redis socket adapter | ⬜ | Horizontal scaling |
| 11 | Public read-only API + Swagger | ⬜ | Rate-limited |
| 12 | Phase-5 schema migration | ⬜ | Likes/follows → collections + MIGRATION.md |

AI features degrade gracefully when GEMINI_API_KEY is not configured
(buttons hidden / checks skipped).
