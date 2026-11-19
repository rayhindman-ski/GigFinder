# GigFinder

A job-discovery workspace for Western Europe: compare 25 curated job boards, filter by title, city, industry and permanent/contract offer type, and heart opportunities for follow-up.

## What works

- A directory of 25 established generalist, national, specialist and remote job boards.
- Server-side searches of the public Arbeitnow, Remotive and Jobicy feeds.
- Observed matching counts by source, with unavailable counts kept distinct from zero.
- Direct-search links for boards without approved data access.
- Saved jobs and source searches stored in the current browser.
- A private Google Drive `CV` document picker, AI summary, and evidenced skills breakdown.
- Independent role selection that triggers a CV-based assessment per role.

## Private CV workspace

Open **CV** and sign in with a verified email matching the connected Google Drive account. Other signed-in accounts cannot browse its documents. Public job browsing and heart saves remain available without sign-in.

The filename search looks directly inside folders named `CV`, with pagination. Open documents in Drive or select one for analysis. Google Docs, text-based PDF, DOCX, plain text, and Markdown are supported, up to 5 MB and 120,000 extracted characters. Images, legacy `.doc`, shortcuts, subfolders, and scanned PDFs without a readable text layer are not analyzed.

Selecting a document sends its extracted text to OpenAI through Replit AI Integrations. No personal API key is required; analysis uses billed Replit credits. The summary and categorized skills cite evidence from that document. AI output is advisory and can be wrong.

With a CV selected, use **Compare to CV** on Discover or Saved, or select roles from the latest scan inside the CV workspace. Each selection starts its own assessment; up to ten roles can be selected at once, with two requests running concurrently. Results show evidenced strengths, requirements not evidenced in the CV, and suggested application improvements. Assessments use the fuller public-feed description, not just the short listing-card preview. Source omissions and descriptions shortened above 40,000 characters are disclosed.

CV text and results stay in owner-scoped server memory for a fixed 30 minutes. A server restart clears them sooner. This tab stores only a user-scoped opaque session reference, never CV text or assessment contents, and can restore completed results while the session exists. Selecting another CV clears the visible old comparison state. Failed roles can be retried independently. Limits are 30 assessments per CV session and 60 analysis requests per hour per owner, enforced per process.

The app uses one creator-connected Drive, not a different Drive per visitor. Do not broaden access to all signed-in users. Horizontal scaling requires shared private session/rate-limit coordination or single-instance operation.

## Coverage and interpretation

This is a curated directory, **not an audited traffic ranking**. The app does not claim to scrape all 25 boards. The other 22 need approved provider access before their live counts can be measured.

Feed counts describe the records actually retrieved, not a source's entire inventory. Arbeitnow uses its latest public page; Jobicy uses its latest 100 records in its seven-day window. Remotive and Jobicy records are restricted to advertised European or worldwide eligibility. All listings link back to their original source.

Cities match advertised location text. A Europe-wide remote role is not inferred to be an Amsterdam-specific match. A full-time role is not classified as permanent without an explicit duration signal. Cross-source duplicates are not collapsed, so totals are listing records, not unique vacancies.

Remotive is cached for six hours in each server process and delays its public feed by 24 hours. Other feeds are cached for one hour; Jobicy imposes a three-hour publishing delay. Production scaling should move this cache into shared durable storage before running multiple server instances.

Saved items remain in the current browser; they do not sync to an account or another device. Saved jobs are snapshots and may expire on the original board.

## Development

This repository is a pnpm workspace with:

- `artifacts/gigfinder` — React/Vite website.
- `artifacts/api-server` — Express API, including `/api/sources` and `/api/scan`.
- `lib/api-spec/openapi.yaml` — API contract.
- `lib/api-client-react` and `lib/api-zod` — generated clients and validators.

Run the managed web and API services in Replit. Outside Replit, configure a reverse proxy so `/api` reaches the API and `/` reaches the web service; provide each service's `PORT` and the frontend's `BASE_PATH=/`.

```sh
pnpm install
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
```

No job-provider API key is required for the three public feeds. Do not add credentials to source control.

## Public data documentation

- [Arbeitnow API](https://www.arbeitnow.com/blog/job-board-api)
- [Remotive API and attribution requirements](https://github.com/remotive-com/remote-jobs-api)
- [Jobicy API and attribution requirements](https://jobicy.com/jobs-rss-feed)
