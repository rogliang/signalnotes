# Signal Notes Migration Proposal: Web App → Chrome Extension-First

## Why Change Now
The current product has strong extraction/scoring intelligence but weak distribution. The existing app requires active pull behavior (open tab, navigate, check), while your real workflow is push-heavy (Slack, Gmail, GDocs).

## Product Strategy
Adopt an **extension-first architecture** that:
1. Keeps the current Railway + Prisma backend as source of truth.
2. Adds Chrome-local state for instant UI responsiveness.
3. Surfaces priorities in high-frequency contexts (toolbar badge + new tab + inline suggestions).
4. Preserves user control via explicit one-click accept/reject flows for AI suggestions.

## What We Reuse From Existing Codebase
- **Extraction logic and prompt shape** in `lib/services/extraction.ts` (already tuned for action evidence, topic normalization, and CEO detection).
- **Action ranking/scoring services** in `lib/services/actionScoring.ts`, `lib/services/standingActions.ts`, and `lib/services/topicFrequency.ts`.
- **Current task APIs** under `app/api/actions/*` and extraction route under `app/api/notes/[id]/extract/route.ts`.
- **Existing relational model** (`Action`, `Topic`, `Evidence`, `MacroGoal`, etc.) in `prisma/schema.prisma`.

## Proposed Target Architecture

### Extension surfaces
- **Toolbar badge**: active task count + urgent indicator.
- **New tab override page**: prioritized task list, quick-add, complete, snooze.
- **Content scripts**:
  - Google Docs: passive context collection + suggestion banner.
  - Gmail: commitment detection + suggestion banner.

### Data flow
1. Content script detects meaningful text delta from GDocs/Gmail.
2. Extension sends normalized payload to backend extraction endpoint.
3. Backend runs existing extraction/scoring.
4. Backend returns structured suggestions (not auto-persisted).
5. User accepts/rejects suggestion in-page.
6. Accepted items are persisted to Railway and mirrored to extension local cache.
7. Badge and new tab update immediately from local cache; background sync reconciles with server.

## API Evolution (Minimal Risk)
Keep existing endpoints; add extension-specific endpoints:
- `POST /api/ingest/extract`  
  Input: `sourceType`, `sourceId`, `title`, `content`, `capturedAt`  
  Output: extracted candidate actions/topics + confidence metadata.
- `POST /api/ingest/commit`  
  Accept selected candidate actions, create `Action` + `Evidence` links.
- `GET /api/extension/tasks`  
  Lightweight prioritized task feed for badge/new tab.
- `POST /api/extension/sync`  
  Batched upsert/ack protocol for offline-safe local-first sync.

## Privacy + Trust Model
- **Default manual commit**: never auto-create tasks from ambient text.
- **Scope gating**: only run content scripts on explicit host permissions (`docs.google.com`, `mail.google.com`).
- **Text minimization**: send only selected excerpts or diff windows, not full document history.
- **User-visible audit trail**: each action stores source metadata and evidence.

## Rollout Plan

### Phase 0 (1 day): Contract + Instrumentation
- Define extraction contract for non-note sources.
- Add source metadata fields (`sourceType`, `sourceRef`) to `Action`/`Evidence`.
- Add telemetry events: suggestion_shown, suggestion_accepted, suggestion_rejected.

### Phase 1 (1–2 days): Visibility MVP
- Build extension shell (Manifest V3).
- Implement new tab tasks UI + toolbar badge.
- Add auth/session bridge to existing backend.
- Implement read-only task feed + complete action flows.

### Phase 2 (2–3 days): Google Docs Suggestions
- Content script for doc text sampling and change detection.
- Reuse extraction backend through `POST /api/ingest/extract`.
- Inline suggestion component with accept/ignore.
- Persist accepted actions and refresh badge/new-tab instantly.

### Phase 3 (2–3 days): Gmail Suggestions
- Content script for open-thread parsing.
- Heuristics for commitment cues ("I will", "can you", dates/names/orgs).
- Same accept/ignore + sync workflow as Docs.

### Phase 4 (1 day): Quality and Control
- Dedupe suggestions against recent accepted actions.
- Suppression controls (mute thread/doc for N days).
- Confidence threshold tuning by source.

## Success Metrics
- **Primary**: Daily Active Use of extension surfaces (badge/new tab opens).
- **Capture efficiency**: % of accepted suggestions / shown suggestions.
- **Latency**: suggestion render p95 < 2.5s.
- **Task follow-through**: completion rate delta vs current web-app baseline.
- **Behavior-change burden**: % of tasks created without opening standalone app.

## Key Risks and Mitigations
- **Risk: noisy suggestions** → confidence thresholds, source-specific prompts, one-click mute.
- **Risk: auth complexity in extension** → token exchange endpoint and short-lived session tokens.
- **Risk: Gmail/Docs DOM fragility** → adapter abstraction + fallback parser + observability.
- **Risk: sync conflicts** → local operation log with server ack IDs and deterministic merge strategy.

## Recommendation
Proceed with **Phase 1 + Phase 2** as the first investment window. This delivers immediate distribution gains (badge/new tab) and validates passive capture in your highest-value authoring surface (Google Docs) before expanding to Gmail.
