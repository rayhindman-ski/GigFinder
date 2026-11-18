# GigFinder

A job-discovery workspace for Western Europe: compare 25 curated job boards, filter by title, city, industry and permanent/contract offer type, and heart opportunities for follow-up.

## What works

- A directory of 25 established generalist, national, specialist and remote job boards.
- Server-side searches of the public Arbeitnow, Remotive and Jobicy feeds.
- Observed matching counts by source, with unavailable counts kept distinct from zero.
- Direct-search links for boards without approved data access.
- Saved jobs and source searches stored in the current browser.

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
