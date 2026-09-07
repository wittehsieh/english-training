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
│       ├── components/learning/       LanguageGapCard, MyEnglishPanel
│       ├── engine/                    ConversationEngine, useConversation, languageGap
│       ├── services/
│       │   ├── conversation/          ConversationService interface + Mock + Http + mockBrain
│       │   └── storage/               StorageService (localStorage)
│       ├── assets/AssetManager.ts     id → asset-URL resolver
│       ├── data/curriculum/           curriculum.json, phrasePatterns.json, learningModel.json
│       ├── data/curriculum.ts         adapter: raw curriculum → runtime Lesson[]
│       ├── data/assets.json           id → artwork URL manifest
│       ├── state/PlayerContext.tsx    XP / level / Personal Language Gaps / settings
│       └── pages/                     Home, Lessons, Conversation, Result, MyEnglish, …
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

## Curriculum (data-driven)

The game plays the **Workplace English RPG Curriculum** package, dropped in at
[`frontend/src/data/curriculum/`](frontend/src/data/curriculum/) (also mirrored
under `backend/src/data/curriculum/`):

| File | Purpose |
| --- | --- |
| `curriculum.json` | chapters → lessons (`mission`, `learningObjectives`, `targetExpressions`, `difficulty`, `xp`) |
| `phrasePatterns.json` | reusable language patterns (`wait for + thing`, `by + deadline`, …) — AI guidance, never answer keys |
| `learningModel.json` | the Personal Language Gap model: priorities, statuses, gap types, evaluation rules |
| `presentationOverrides.json` | per-lesson visual-novel presentation (coworker, scene, opening line) — the only place this is decided, and it is data, not code |

**Target expressions are NOT answer keys.** The player types free-form English;
any response that communicates the intent is accepted. The expressions are
guidance the AI may introduce or reference.

### How a lesson is loaded

`curriculum.json` is raw content. [`frontend/src/data/curriculum.ts`](frontend/src/data/curriculum.ts)
adapts each raw lesson into the runtime `Lesson` the visual novel plays:

```
curriculum.json lesson            +  presentationOverrides.json[id]  +  characters.ts
  { mission, learningObjectives,        { characterId, background,        { emily: {name,role,
    targetExpressions, difficulty,        openingText, openingEmotion }      personality} , … }
    xp }
                     │
                     ▼   toRuntimeLesson()
  Lesson { scene{background}, characters[], conversation.opening,
           learningObjectives[{id,description}],  // humanized via OBJECTIVE_LIBRARY
           targetExpressions[{id,text,patternId?}], // linked to phrasePatterns
           completionCriteria{requiredObjectives, minimumTurns} }
```

Any lesson id missing from `presentationOverrides.json` falls back to a
deterministic default (scene + coworker rotate per chapter, opening derived from
the mission). Components import `CHAPTERS` / `LESSONS` / `getLesson()` — never a
JSON file directly.

### Personal Language Gap — the core mechanism

We do **not** record everything the player meets. Each evaluated turn returns a
`TurnLanguageAnalysis` (`understoodIntent`, `meaningCommunicated`, `grammarOk`,
`natural`, `contextAppropriate`, `gap`, `patternsUsedNaturally`). Only a turn
with `gap !== null` becomes or reinforces a stored `LanguageGap`.

- **Storage:** `PlayerProfile.languageGaps` in `localStorage` (via
  `StorageService`), updated by `usePlayer().observeTurn(analysis, lessonId)`
  which calls the pure functions in
  [`frontend/src/engine/languageGap.ts`](frontend/src/engine/languageGap.ts).
- **A new slip** → record created with `status: 'needs_practice'`, one
  `incorrect` mastery-evidence entry.
- **Same slip again** → `timesObserved++`, confidence up.
- **Using a tracked pattern correctly & spontaneously** → `natural_spontaneous`
  evidence; status climbs `needs_practice → developing → familiar → mastered`
  (mastered needs natural use in **2 different lessons**).
- **Not over-teaching:** concepts at `familiar`/`mastered` are passed to the
  evaluator as `comfortableConcepts` and it stops surfacing them. Using a
  pattern well that we are *not* tracking a gap for records **nothing** — the
  player already knows it.

Seen in the app on the **My English** screen (grouped Working on / Getting there / All).

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
3. Point a lesson at it in `presentationOverrides.json`:
   `"office-06": { "background": "rooftop-evening", ... }`.

### How to add a new **character**

1. Create `frontend/public/assets/characters/<id>/` with the expression files.
2. Add to `assets.json` → `characters` (URLs) **and**
   [`frontend/src/data/characters.ts`](frontend/src/data/characters.ts) → `CHARACTERS`
   (name, role, personality — the personality feeds the AI prompt).
3. Assign the character to lessons in
   [`presentationOverrides.json`](frontend/src/data/curriculum/presentationOverrides.json):
   `"office-06": { "characterId": "<id>", ... }`. Also mirror steps 2–3 in
   `backend/src/data/lessons.ts` (`CHARACTERS` + `OPENINGS`).

### How to add a new **expression**

1. Add the image, e.g. `characters/emily/excited.webp`.
2. Add the key to that character's `expressions` map in `assets.json`.
3. Add the literal to `CharacterExpression` in
   `frontend/src/types/assets.ts` (and the emotion set on the backend if the AI
   should return it). Unknown/missing expressions fall back to `neutral`.

### How to add a new **lesson**

1. Add the lesson object to the right chapter in
   [`curriculum/curriculum.json`](frontend/src/data/curriculum/curriculum.json)
   (`id`, `title`, `mission`, `learningObjectives`, `targetExpressions`,
   `difficulty`, `xp`).
2. Optionally add a `presentationOverrides.json` entry (coworker, scene,
   opening line) — otherwise it gets sensible defaults.
3. New objective ids get a title-cased description automatically; add a nicer
   one to `OBJECTIVE_LIBRARY` in `curriculum.ts` if you want.
4. Mirror the lesson (and any opening) into `backend/src/data/curriculum/` +
   `backend/src/data/lessons.ts` if you run the backend.

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

**Mocked today** — `mockBrain.ts` (frontend) and `MockAIConversationService`
(backend) apply the `learningModel.json` contract with rules instead of an LLM:

- infer intent from keyword buckets (else the current open objective);
- a small table of common ESL slips → `LanguageGapObservation`
  (`wait for + noun`, `by` vs `until`, `almost done`, `blocked on`, …);
- regex-match `phrasePatterns.json` heads for "used naturally" credit;
- advance one objective per meaningful turn; finish on required objectives +
  minimum turns; XP from rating + pattern bonus + lesson XP;
- honour `comfortableConcepts` so familiar/mastered gaps aren't re-taught.

Character art & backgrounds are generated CSS placeholders until real files land.

**Remaining before connecting OpenAI**

1. `cd backend && npm i openai`.
2. Implement `evaluateTurn` in `OpenAIConversationService.ts`: send
   `buildSystemPrompt(lesson)` (already written to emit the full `analysis`
   object) + `formatTranscript(history)` + the `comfortableConcepts` list,
   request a JSON object, and **validate it against `AiTurnResult`** before
   returning (reject/repair malformed output).
3. In `AIConversationService.ts`, return `new OpenAIConversationService(...)`
   when `OPENAI_API_KEY` is set (the factory hook is already there).
4. Deploy the backend; set `VITE_API_BASE_URL` in the Pages workflow env.
5. Optionally move `curriculum/` + the adapter into a shared workspace package
   so frontend and backend stop keeping parallel copies.

No frontend, route, page, or component changes are required — the
`AiTurnResult` + `TurnLanguageAnalysis` contract is already in place and the UI
cannot tell the mock from the real thing.
