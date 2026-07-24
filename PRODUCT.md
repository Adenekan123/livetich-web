# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user: independent skill instructors** — solo experts and creators (coding, design, music, trades, and similar) who teach paid live cohorts to their own students. They are the person livetich most wants to succeed: they set up a course, run the live room, and keep a large class engaged in real time.

**Secondary user: enrolled students** — cohort members who join live sessions to learn, compete in buzzer rounds, climb the leaderboard, and earn a certificate. `STUDENT` and `INSTRUCTOR` are the two confirmed roles in the system.

## Product Purpose

livetich brings a real, interactive classroom online. An instructor runs a single live room where video, a shared chalkboard, moderated chat, buzzer quizzes, a points leaderboard, and certificate issuance all happen together — instead of stitching a video call, a chat app, a quiz tool, and a slide deck into one class. Success is a live session where students actually show up, participate, and stay engaged from start to finish.

## Positioning

**The wedge is gamified live engagement.** Buzzer quizzes plus a live points leaderboard turn a large live class into friendly competition, which is what makes a big room stay focused and coming back. Buzzer/quiz timing is decided on the server (server-authoritative), so "who answered first" is fair to the millisecond and not disputable — a property a bolt-on quiz tool layered over a generic video call cannot truthfully claim. "Live and interactive, not another passive video library" frames the category; the competitive engagement loop is the differentiated mechanism inside it.

## Operating Context

- **Structure:** an instructor creates a **course**, which contains ordered **sections**; a **live session** is scheduled against a course (optionally a section) and moves through `SCHEDULED → LIVE → ENDED`.
- **The live room** is the core scene. In one room, an instructor can: stream video, draw on a shared chalkboard the whole class follows, moderate chat (lock/unlock, raise-hand queue, random student pick), run buzzer quiz rounds, grant/revoke student screen-share, and watch the leaderboard update live.
- **Students** join the room to watch, chat, raise a hand, answer buzzer questions, and track their standing.
- **After a course**, an instructor can issue a student a verifiable certificate.

## Capabilities and Constraints

Confirmed, in-product functionality:

- **Live video** via LiveKit / WebRTC, including student screen-share that the instructor grants and revokes.
- **Shared chalkboard** built on tldraw, synced with Yjs over a dedicated `/board` realtime namespace (instructor draws; document state and incremental updates broadcast to the room; awareness/cursors relayed but not persisted).
- **Realtime room** over Socket.IO: presence, chat with history and lock, raise-hand queue, random student pick, buzzer/quiz lifecycle, leaderboard updates, and personal answer results.
- **Buzzer / quiz** with a server-authoritative lifecycle (`IDLE → COLLECTING → QUESTION_OPEN → WINNER / TIMEOUT → QA`); server timestamps every answer.
- **Points & leaderboard**, earned via `QUIZ_CORRECT`, `BUZZER_WIN`, `PARTICIPATION`.
- **Certificates** with a verification code and optional PDF, issued by an instructor to a student.

Technical constraints:

- **Frontend only lives here.** All data and realtime behavior come from a separate backend, `livetich-api` (REST + Socket.IO + the Yjs board namespace), reached via `NEXT_PUBLIC_API_URL`. `src/lib/realtime-contract.ts` and `src/lib/types.ts` must stay in sync with the API's shared contract.
- **Stack:** Next.js 16, React 19, Tailwind CSS v4, TypeScript. Per `AGENTS.md`, this Next.js version has breaking changes from prior training data — consult `node_modules/next/dist/docs/` before writing framework code.

Terminology: `course`, `section`, `live session`, `room`, `buzzer round`, `leaderboard`, `certificate`, `instructor`, `student`.

## Brand Commitments

- **Name:** **livetich**, lowercase, used as the wordmark alongside a rounded gradient play-button logo mark.
- **Existing tagline in code:** "Learn skills live." Recorded as the incumbent line, not confirmed by the user as permanently binding.
- The current indigo/violet/fuchsia visual treatment on the marketing homepage is the **incumbent implementation**, not a user-ratified brand constraint. It is design evidence for later visual work, not product truth captured here.

## Evidence on Hand

- **Real product surface exists:** working auth (login/register), dashboard, course browse/detail with instructor panels, and a live session room (`src/app/sessions/[id]/`) with video, tldraw board, and classroom controls.
- **No confirmed external proof.** There are currently **no verified testimonials, customer names, case studies, press, logos, benchmarks, or usage numbers.** Future marketing work must not fabricate any of these.
- **Landing-page figures are aspirational placeholders, not product facts:** "500 students per room," "<200ms answer-to-buzz latency," "6 tools in one room," "100% verifiable certificates," and "free to start" are unverified marketing copy. Do not present them as tested capabilities or committed pricing until confirmed. Pricing/plans are undecided.

## Product Principles

1. **Engagement is the product.** Every surface should push toward a live class where students participate and compete, not passively watch. The buzzer-and-leaderboard loop is the reason to choose livetich.
2. **Fairness is server-decided.** "Who was first / who was right" is settled by the server, never the client. Preserve this trust property; never imply timing is negotiable.
3. **One room, not a toolchain.** Keep the live class experience unified; resist splintering video, board, chat, and quizzes into disconnected surfaces.
4. **Instructor-first, student-delighting.** Optimize the instructor's ability to run a big room with confidence, while making the student's moment of winning points feel rewarding.
5. **Claim only what's true.** Until numbers, pricing, and proof are verified, do not state them as fact anywhere user-facing.

## Accessibility & Inclusion

No product-specific accessibility standard has been established with the user yet. Default to standard web accessibility practice; capture a firm requirement here if one is later confirmed.
