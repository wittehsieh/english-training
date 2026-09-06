# Workplace English Adventure

A **mobile-first 2D visual-novel game** for practising workplace English. You
walk into a workplace scene, a coworker starts talking, and you reply in your
own words. An AI keeps the conversation going, nudges you toward more natural
phrasing, and tracks the lesson objectives.

> Learn English by **using** it, not by answering English questions.
> The visual-novel format is just an effective way to present characters,
> scenes and conversations. There are **no romance mechanics** — everyone is a
> colleague.

---

## Monorepo layout

```
.
├── frontend/          React + TS + Vite. Deploys to GitHub Pages.
│   ├── public/assets/  AI-generated artwork drops in here (git-ignored content)
│   └── src/
│       ├── components/visual-novel/   Scene, Character, DialogueBox, PlayerInput …
│       ├── engine/                    ConversationEngine + useConversation hook
│       ├── services/
│       │   ├── conversation/          ConversationService interface + Mock + Http
│       │   └── storage/               StorageService (localStorage)
│       ├── assets/AssetManager.ts     id → asset-URL resolver
│       ├── data/                      lessons.json + assets.json (data-driven!)
│       ├── state/PlayerContext.tsx    XP / level / phrase book / settings
│       └── pages/                     Home, Lessons, Conversation, Result, …
│
└── backend/           Node + Express + TS. Deploy separately (Cloud Run / Render / …).
    └── src/
        ├── routes/conversation.ts     POST /api/conversation/start | /message
        ├── services/
        │   ├── AIConversationService.ts       interface + factory
        │   ├── MockAIConversationService.ts   rule-based stand-in (default)
        │   └── OpenAIConversationService.ts   Phase-2 skeleton (not wired)
        └── prompts/systemPrompt.ts     the future OpenAI system prompt
```

### Architecture

```
Browser ──► React frontend ──► ConversationService
                                   │
                    ┌──────────────┴───────────────┐
            MockConversationService        HttpConversationService
            (in-browser, offline)                  │
                                                   ▼
                                     Backend  /api/conversation/*
                                                   │
                                          AIConversationService
                                    ┌──────────────┴──────────────┐
                            MockAIConversationService   OpenAIConversationService
                                  (default)                  (Phase 2)
```

The frontend only ever talks to the `ConversationService` **interface**. With
no `VITE_API_BASE_URL` it uses the in-browser mock (this is what GitHub Pages
runs). Point it at the backend and nothing else changes. Later the backend
swaps its mock for OpenAI and, again, nothing else changes.

**`OPENAI_API_KEY` lives only in `backend/.env`. It is never imported by, bundled
into, or sent to the frontend.**

---

## Getting started

```bash
npm install          # installs both workspaces

npm run dev           # frontend (:5173) + backend (:8787) together
npm run dev:frontend  # just the frontend (fully works on its own)
npm run dev:backend   # just the backend

npm run build          # builds the frontend (what GitHub Pages ships)
npm run typecheck      # tsc --noEmit for both workspaces
```

By default the frontend runs standalone with the mock conversation engine. To
use the backend instead:

```bash
cp backend/.env.example backend/.env      # optional — mock works with no key
echo 'VITE_API_BASE_URL=http://localhost:8787' > frontend/.env
npm run dev
```

### Environment variables

| Variable            | Where            | Purpose                                                        |
| ------------------- | ---------------- | ------------------------------------------------------------- |
| `VITE_API_BASE_URL` | `frontend/.env`  | Backend URL. Empty ⇒ in-browser mock.                        |
| `OPENAI_API_KEY`    | `backend/.env`   | Enables OpenAI (Phase 2). Empty ⇒ mock AI. **Backend only.** |
| `OPENAI_MODEL`      | `backend/.env`   | Model id, default `gpt-4o-mini`.                             |
| `PORT`              | `backend/.env`   | Backend port, default `8787`.                                |
| `CORS_ORIGIN`       | `backend/.env`   | Comma-separated allowed origins.                             |

`.env` files are git-ignored; only `.env.example` is committed.

---

## Content is data-driven

Lessons are **not** hard-coded in components. They live in
[`frontend/src/data/lessons.json`](frontend/src/data/lessons.json) and describe
*what* to teach, not every possible player line:

```jsonc
{
  "id": "project-update-001",
  "category": "project_update",
  "scene": { "background": "office-morning" },          // asset id, not a path
  "characters": [
    { "id": "emily", "name": "Emily", "role": "PM",
      "expression": "neutral", "position": "center" }
  ],
  "learningObjectives": [
    { "id": "describe_progress", "description": "Describe current progress" }
  ],
  "targetPhrases": [
    { "id": "almost_done", "phrase": "I'm almost done with it.",
      "meaning": "我差不多完成了。", "usage": "…" }
  ],
  "conversation": { "opening": { "characterId": "emily", "text": "How's the project going?" } },
  "completionCriteria": { "requiredObjectives": ["describe_progress"], "minimumTurns": 4 }
}
```

The AI decides how the conversation actually unfolds.

---

## Artwork & the asset system

Backgrounds and character sprites are **independent assets** generated later by
an external AI image workflow. Nothing in `src/` hard-codes a file path.

- **Manifest:** [`frontend/src/data/assets.json`](frontend/src/data/assets.json)
  maps ids → URLs.
- **Resolver:** [`frontend/src/assets/AssetManager.ts`](frontend/src/assets/AssetManager.ts)
  — `getBackground(id)`, `getCharacter(id, expression)`, `hasCharacter(...)`,
  `preload(...)`.
- **Rendering:** `<VisualNovelScene background="office-morning" characters={[…]} />`
  and `<Character characterId="emily" expression="happy" position="center" />`.
- **Missing files never break the UI** — `<img onError>` falls back to a
  generated CSS placeholder.
- **Expressions:** `neutral · happy · surprised · concerned · thinking · talking`.
  The AI returns one of these per turn and the character updates.

### How to add a new **background**

1. Save the image at `frontend/public/assets/backgrounds/<place>/<variant>.webp`.
2. Add an entry to `assets.json` → `backgrounds`:
   ```json
   "rooftop-evening": { "id": "rooftop-evening", "src": "/assets/backgrounds/rooftop/evening.webp", "focalPoint": "50% 40%" }
   ```
3. Reference it from a lesson: `"scene": { "background": "rooftop-evening" }`.

### How to add a new **character**

1. Create `frontend/public/assets/characters/<id>/` with the expression files.
2. Add to `assets.json` → `characters`:
   ```json
   "alex": { "id": "alex", "name": "Alex", "role": "Designer",
     "expressions": { "neutral": "/assets/characters/alex/neutral.webp", "...": "..." } }
   ```
3. Reference from a lesson's `characters` array by `id`.

### How to add a new **expression**

1. Add the image, e.g. `characters/emily/excited.webp`.
2. Add the key to that character's `expressions` map in `assets.json`.
3. Add the literal to `CharacterExpression` in
   `frontend/src/types/assets.ts` (and the emotion set on the backend if the AI
   should return it). Unknown/missing expressions fall back to `neutral`.

---

## GitHub Pages deployment

- Vite `base` is `'/english-training/'` → served at
  `https://wittehsieh.github.io/english-training/`.
- Routing uses `HashRouter`, so deep links work without a 404 shim.
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds
  `frontend/` and publishes `frontend/dist` on every push to `main`.
- The **backend is not deployed to Pages** (Pages is static). Deploy it to
  Cloud Run / Render / Railway / Fly / a VM, then set `VITE_API_BASE_URL` (in
  the workflow env) to its URL and redeploy the frontend.

One-time repo setup: **Settings → Pages → Build and deployment → Source:
GitHub Actions**.

---

## What is mocked / what's next

**Mocked today**

- `MockConversationService` (frontend) and `MockAIConversationService`
  (backend) — small deterministic rules: match a target phrase, catch a few
  common ESL slips, advance one objective per solid turn, finish when the
  required objectives + minimum turns are met.
- Character art & backgrounds — generated CSS placeholders.

**Remaining for real OpenAI integration**

1. `cd backend && npm i openai`.
2. Implement `evaluateTurn` in `OpenAIConversationService.ts` using
   `buildSystemPrompt(lesson)` + the transcript, requesting a JSON object that
   matches `AiTurnResult`; validate it before returning.
3. In `AIConversationService.ts`, return `new OpenAIConversationService(...)`
   when `OPENAI_API_KEY` is set.
4. Deploy the backend; set `VITE_API_BASE_URL`.

No frontend, route, or component changes are required — the `AiTurnResult`
contract is already in place.
