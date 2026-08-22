# UI Display Audit — grid vs. modal vs. page

*Product-flow + UI-critic pass over every feature's incoming data structure
(`src/lib/types.ts`) and the container it's presented in today. Verdict per
surface, with the concrete opportunities called out. No code was changed by
this audit — it is the decision record for what (if anything) to build next.*

Design rules: [`DESIGN.md`](../DESIGN.md) → §"Display-pattern rules".

---

## The heuristic

| Pattern | Use when the data is… | Signals |
|---|---|---|
| **Tabular grid** | A collection of **comparable records with many scannable attributes** the user sorts/compares | ≥4 columns of parallel facts; the job is compare/rank/scan |
| **Modal** | A **quick single-record create/edit** that must keep the user in context | Low field count; reversible; the list behind it is the real destination |
| **New page (route)** | **Immersive, complex, timed, or long-form** work | Deserves the whole viewport + a shareable URL; losing it mid-task is costly |

Bias: **don't move working surfaces.** A container that already matches its data is not a bug. The value is in the mismatches.

---

## Full matrix

Legend — ✅ correct · ⚠️ improvement candidate · 🆕 gap (no dedicated surface)

| # | Feature data (`types.ts`) | Cardinality / shape | Optimal | Current surface | Verdict |
|---|---|---|---|---|---|
| 1 | `StudentStat` — points, interactions, attendance, submissions (8 metrics) | Many rows × many numeric cols | **Sortable table** | `account/student-performance-table.tsx` (table) | ⚠️ table ✓ but **not sortable** |
| 2 | Course roster `StudentRef` + certified state | Many rows, few cols | Table / list | `courses/[id]/student-roster-table.tsx` + `course-roster-panel.tsx` | ✅ |
| 3 | `OrgMember` — instructors / students | Many rows, name·email·status | Table | `account/instructors` (table); students list | ✅ |
| 4 | `OrgInvite` — label·role·uses·expiry·status | Few–many rows, 5 cols | Table/list | `account/invite-link-panel.tsx` | ✅ (list acceptable at low count) |
| 5 | `ExamListRow` — duration·questions·submissions·avgScore | Rows × 4 metrics | **Table** | `courses/[id]/exams/exam-manager.tsx` (cards) | ⚠️ **metrics as cards → table scans better** |
| 6 | `ExamResults` — students[] + topics[] accuracy | Two comparable collections | **Two tables** | inside `exam-manager` | ⚠️ verify; tabular fits |
| 7 | `AssignmentTracking` — submitted[] + missing[], per-student grade/feedback | Nested: assignment → audience split → per-submission grading | **Table/list of assignments; grade a submission in a modal or side panel** | `courses/[id]/assignment-lab.tsx` | ⚠️ **rich data; confirm grading isn't over-stuffed in one modal** |
| 8 | `HifzOverviewRow` — targets[] + entries[] + progress, per student | Nested per-student (goals + recitation log) | **Table w/ expandable row** | `courses/[id]/hifz/hifz-manager.tsx` (cards) | ⚠️ **cards don't scan; expandable table fits** |
| 9 | `StudentGroup` + `GroupMember` | Few groups, membership lists | List + create/edit **modal** | `courses/[id]/groups/groups-manager.tsx` | ✅ |
| 10 | `Certificate` (mine) | Few cards, download/verify actions | Cards/list | dashboard cards | ✅ |
| 11 | `AssessmentQuestion` / `RemediationTask` bank | Editable bank rows | List + inline/modal edit | `assessment` manager | ✅ |
| 12 | Create program / section / assignment / invite / assign-to-group | Single record, few fields | **Modal** | `new-program-modal`, `add-section-modal`, `add-assignment-form`, `assign-program-button` | ✅ |
| 13 | `CatalogCourse` catalog | Many cohort cards + filter/search | Card grid | `courses/course-browser.tsx` | ✅ |
| 14 | `ExamStart` — timed attempt, deadline | Long, timed, focus-critical | **Full page** | `courses/[id]/exams` (`exam-taker`) | ✅ |
| 15 | `AssessmentTake` — quiz / graded result | Focused task | **Page** | `assessment/[assessmentId]` | ✅ |
| 16 | `StudentAssignment` + submit (file/code) | Long-form submission | **Page** | `assignments/[assignmentId]` | ✅ |
| 17 | `ExamReview` — answer key + picks | Read-heavy review | Page | `exam-taker` review state | ✅ |
| 18 | Live room (`sessions/[id]`) — video, board, chat, buzzer | Immersive, real-time | **Full-screen page** | `sessions/[id]/class-room.tsx` | ✅ |
| 19 | Brand kit / profile / password | Single settings record | Own **page** | `account/*` | ✅ |

**Headline:** ~80% of surfaces already sit in the right container. The IA is sound; the redesign this session brought the visuals current. What remains is **three targeted improvements**, not a rebuild.

---

## The three opportunities worth building

### P1 — Sortable performance table (#1)
`StudentStat` is the app's densest comparable dataset (points, interactions,
attendance ratio, submissions). It renders as a static table. **Add column sort**
(points, attendance %, submissions) so an instructor can rank a big cohort. Pure
enhancement to `student-performance-table.tsx`; no data/API change.
**Pattern stays a table** — just make it do the one thing tables are for.

### P2 — Hifz overview as an expandable table (#8)
`HifzOverviewRow` is per-student nested data (targets + recitation log +
progress). As cards it forces vertical scrolling and defeats cross-student
comparison. **Convert `hifz-manager` to a table** — one row per student with
progress columns (ayahs memorized, surahs, last recited), **expanding** to reveal
that student's targets and entry log. Keeps the log detail, gains scannability.

### P3 — Exam manager as a metric table (#5, #6)
`ExamListRow` and `ExamResults` are exactly the "comparable records × numeric
columns" case the card layout under-serves. **Move `exam-manager`'s list to a
table** (title · duration · #questions · #submissions · avg score, sortable), and
render `ExamResults` as a students table + a topic-accuracy table. Builder actions
(create/edit exam) stay in their **modal**; taking the exam stays a **page**.

---

## Non-goals (explicitly leave alone)

- All create/edit **modals** (#12) — correct; low field count, keep context.
- All immersive **pages** (#14–18) — correct; timed/long/real-time work.
- Catalog card grid, certificate cards, groups — correct for their cardinality.

Rebuilding these would be rework against a now-current design system, with
regression risk and no user-visible gain.

---

## If/when these are built

Follow [`DESIGN.md`](../DESIGN.md): teal/amber tokens via `lib/ui`, Lexend/Source
Sans, hairline `neutral-200` borders, teal focus ring, no emoji-as-icons, status
by colour **+** glyph, and every table responsive (horizontal scroll inside its
own container, never the page). Preserve all existing socket/LiveKit/tldraw
behavior — these are visual/layout changes only.
