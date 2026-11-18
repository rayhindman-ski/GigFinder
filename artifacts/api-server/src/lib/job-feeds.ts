import { logger } from "./logger";
import type { Filters } from "./job-sources";

export interface Job {
  id: string;
  sourceId: string;
  title: string;
  company: string;
  location: string;
  offerType: string;
  industry: string;
  url: string;
  publishedAt: string | null;
  description: string;
  remote: boolean;
}

interface Feed {
  jobs: Job[];
  fetchedAt: string;
  scope: string;
}
type RecordValue = Record<string, unknown>;
const cache = new Map<string, { expires: number; feed?: Feed; error?: string }>();
const pending = new Map<string, Promise<Feed>>();

function text(value: unknown): string {
  const raw = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  return raw.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&[^; ]+;/g, " ").replace(/\s+/g, " ").trim();
}

function offerType(value: unknown, description: string): string {
  const type = text(value);
  if (/\b(contract|contractor|freelance|freelancer|temporary|befristet)\b/i.test(type)) return "contract";
  if (/\b(permanent|unbefristet|festanstellung|cdi)\b/i.test(`${type} ${description}`)) return "permanent";
  // Full-time describes hours, not contract duration: never infer permanent from it.
  if (/\b(full.?time|vollzeit)\b/i.test(type)) return "Full-time · duration unspecified";
  if (/\b(part.?time|teilzeit)\b/i.test(type)) return "Part-time · duration unspecified";
  return "Not specified";
}

function date(value: unknown): string | null {
  if (!value) return null;
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalize(row: RecordValue, sourceId: string): Job | null {
  const arbeit = sourceId === "arbeitnow";
  const jobicy = sourceId === "jobicy";
  const title = text(jobicy ? row.jobTitle : row.title);
  const company = text(jobicy ? row.companyName : row.company_name);
  const description = text(jobicy ? row.jobDescription : row.description);
  const rawUrl = String(row.url ?? "");
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol) || !title || !company) return null;
  const location = text(arbeit ? row.location : jobicy ? row.jobGeo : row.candidate_required_location);
  // The remote boards are global; only include roles that explicitly allow our region.
  if (!arbeit && !/\b(worldwide|anywhere|europe|emea|eu|uk|united kingdom|germany|france|netherlands|belgium|ireland|switzerland|austria|luxembourg|liechtenstein|monaco)\b/i.test(location)) return null;
  return {
    id: `${sourceId}-${String(row.id ?? row.slug)}`,
    sourceId, title, company, location: location || "Location not specified",
    offerType: offerType(jobicy ? row.jobType : arbeit ? row.job_types : row.job_type, description),
    industry: text(jobicy ? row.jobIndustry : arbeit ? row.tags : row.category) || "Not specified",
    url: url.toString(),
    publishedAt: date(arbeit ? row.created_at : jobicy ? row.pubDate : row.publication_date),
    description: description.slice(0, 650),
    remote: arbeit ? row.remote === true : true,
  };
}

async function getJson(url: string): Promise<RecordValue> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: "application/json", "User-Agent": "GigFinder/1.0 (public job discovery; links to original source)" },
  });
  if (!response.ok) throw new Error(`Public feed returned HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unexpected public feed response");
  return data as RecordValue;
}

async function fetchFeed(sourceId: string): Promise<Feed> {
  const rows: RecordValue[] = [];
  let scope = "";
  if (sourceId === "arbeitnow") {
    // Bound pagination and network time; be explicit that this is not site-wide inventory.
    const data = await getJson("https://www.arbeitnow.com/api/job-board-api");
    if (!Array.isArray(data.data)) throw new Error("Arbeitnow did not return its jobs array");
    rows.push(...data.data);
    scope = `Latest ${rows.length} public-feed listings; not board-wide inventory`;
  } else if (sourceId === "remotive") {
    const data = await getJson("https://remotive.com/api/remote-jobs");
    if (!Array.isArray(data.jobs)) throw new Error("Remotive did not return its jobs array");
    rows.push(...data.jobs);
    scope = `${rows.length} public-feed listings checked; Europe/worldwide eligible only; publisher delays listings by 24 hours`;
  } else if (sourceId === "jobicy") {
    const data = await getJson("https://jobicy.com/api/jobs?count=100");
    if (!Array.isArray(data.jobs)) throw new Error("Jobicy did not return its jobs array");
    rows.push(...data.jobs);
    scope = `Latest ${rows.length} public-feed listings from the last 7 days; Europe/worldwide eligible only${data.hasMore ? "; additional pages not included" : ""}; publisher delay: 3 hours`;
  } else {
    throw new Error("No public-feed adapter for this source");
  }
  const jobs = rows.map(r => normalize(r, sourceId)).filter((r): r is Job => r !== null);
  return { jobs: [...new Map(jobs.map(j => [j.id, j])).values()], fetchedAt: new Date().toISOString(), scope };
}

export async function loadFeed(sourceId: string): Promise<Feed> {
  const old = cache.get(sourceId);
  if (old && old.expires > Date.now()) {
    if (old.error) throw new Error(old.error);
    if (old.feed) return old.feed;
  }
  const inFlight = pending.get(sourceId);
  if (inFlight) return inFlight;
  const request = fetchFeed(sourceId).then(feed => {
    // Honor Remotive's maximum four refreshes per day; filters operate on cached records.
    const ttl = sourceId === "remotive" ? 6 * 60 * 60_000 : 60 * 60_000;
    cache.set(sourceId, { feed, expires: Date.now() + ttl });
    return feed;
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Public feed unavailable";
    cache.set(sourceId, { error: message, expires: Date.now() + 5 * 60_000 });
    logger.warn({ sourceId, message }, "Job feed unavailable");
    throw new Error(message);
  }).finally(() => pending.delete(sourceId));
  pending.set(sourceId, request);
  return request;
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function includesWords(haystack: string, query: string): boolean {
  const h = normalized(haystack);
  return normalized(query).split(/\s+/).filter(Boolean).every(term => h.includes(term));
}
const industryTerms: Record<string, string[]> = {
  technology: ["software", "technology", "engineering", "developer", "data", "devops", "cybersecurity"],
  "technology & it": ["software", "technology", "engineering", "developer", "data", "devops", "cybersecurity"],
  finance: ["finance", "financial", "accounting", "banking"],
  "finance & banking": ["finance", "financial", "accounting", "banking"],
  healthcare: ["health", "medical", "nursing", "clinical"],
  marketing: ["marketing", "advertising", "seo", "content"],
  design: ["design", "creative", "ux", "ui"],
  sales: ["sales", "business development", "account executive"],
  education: ["education", "teaching", "learning"],
};

export function matches(job: Job, filters: Filters): boolean {
  if (filters.title && !includesWords(job.title, filters.title)) return false;
  if (filters.city && !includesWords(job.location, filters.city)) return false;
  if (filters.offerType && filters.offerType !== "all" && job.offerType !== filters.offerType) return false;
  const industry = filters.industry?.trim();
  if (industry && !/^all( industries)?$/i.test(industry)) {
    const terms = industryTerms[industry.toLowerCase()] ?? [industry];
    if (!terms.some(term => includesWords(`${job.industry} ${job.title} ${job.description}`, term))) return false;
  }
  return true;
}
