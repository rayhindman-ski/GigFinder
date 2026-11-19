import { Router, type IRouter } from "express";
import { GetSourcesResponse, ScanSourcesBody, ScanSourcesResponse } from "@workspace/api-zod";
import { sources, searchUrl } from "../lib/job-sources";
import { loadFeed, matches, type Job } from "../lib/job-feeds";

const router: IRouter = Router();

router.get("/sources", (_req, res) => {
  res.json(GetSourcesResponse.parse(sources));
});

let activeScans = 0;
router.post("/scan", async (req, res): Promise<void> => {
  const input = ScanSourcesBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Please provide valid title, city, industry and offer type filters." });
    return;
  }
  if (activeScans >= 12) {
    res.setHeader("Retry-After", "15");
    res.status(429).json({ error: "Job search is busy. Please retry in a few seconds." });
    return;
  }
  activeScans++;
  try {
    const filters = {
      title: input.data.title.trim(),
      city: input.data.city.trim(),
      industry: input.data.industry.trim(),
      offerType: input.data.offerType,
    };
    const matchedJobs: Job[] = [];
    const results = await Promise.all(sources.map(async source => {
      const common = { sourceId: source.id, searchUrl: searchUrl(source, filters) };
      if (!source.liveSupported) return {
        ...common, count: null, status: "direct" as const, checkedAt: null,
        countScope: "Not measured",
        message: "Live counts require an approved data connection. Open the source to run this search; confirm filters on the destination.",
      };
      try {
        const feed = await loadFeed(source.id);
        const jobs = feed.jobs.filter(job => matches(job, filters));
        matchedJobs.push(...jobs);
        return {
          ...common, count: jobs.length, status: "live" as const,
          checkedAt: feed.fetchedAt, countScope: feed.scope,
          message: "Observed matches in the available public feed, not the source's entire inventory.",
        };
      } catch (error) {
        return {
          ...common, count: null, status: "unavailable" as const, checkedAt: null,
          countScope: "Not measured",
          message: error instanceof Error ? error.message : "Public feed could not be reached. Try the direct search.",
        };
      }
    }));
    matchedJobs.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    // Avoid letting a high-volume board crowd every other source out of the
    // card limit. Retain each source's newest records in a balanced sample.
    const buckets = sources.filter(s => s.liveSupported)
      .map(source => matchedJobs.filter(job => job.sourceId === source.id));
    const shownJobs: Job[] = [];
    for (let i = 0; shownJobs.length < 200 && buckets.some(b => i < b.length); i++) {
      for (const bucket of buckets) {
        const job = bucket[i];
        if (job && shownJobs.length < 200) shownJobs.push(job);
      }
    }
    shownJobs.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    res.json(ScanSourcesResponse.parse({
      filters, scannedAt: new Date().toISOString(), sources: results,
      jobs: shownJobs, totalMatches: matchedJobs.length,
      liveSources: results.filter(r => r.status === "live").length,
      notice: "Counts cover matching records in available public feeds only, not all jobs on all 25 sites. Unknown counts are not zero. Cities match advertised location text; regional remote roles are not inferred as city matches. Full-time is not assumed permanent. Feeds are cached (Remotive: 6h, others: 1h); publisher delays apply. Up to 200 matching jobs are shown. Directory is curated, not a traffic ranking.",
    }));
  } finally {
    activeScans--;
  }
});

export default router;
