export interface JobSource {
  id: string;
  name: string;
  domain: string;
  url: string;
  description: string;
  countries: string[];
  category: string;
  color: string;
  initials: string;
  liveSupported: boolean;
}

type Definition = [string, string, string, string[], string, string, string];
const definitions: Definition[] = [
  ["linkedin", "LinkedIn", "linkedin.com", ["Western Europe"], "Professional network", "#0a66c2", "Professional roles and employer networks across Europe."],
  ["indeed", "Indeed", "indeed.com", ["Western Europe"], "Generalist", "#2557a7", "Broad coverage of permanent and contract opportunities."],
  ["glassdoor", "Glassdoor", "glassdoor.com", ["Western Europe"], "Generalist", "#0caa41", "Job opportunities alongside employer insights."],
  ["stepstone", "StepStone", "stepstone.de", ["Germany", "Belgium"], "Generalist", "#e6383f", "Established board for professional roles in Germany and Belgium."],
  ["reed", "Reed", "reed.co.uk", ["United Kingdom"], "Generalist", "#e71b46", "UK opportunities across sectors and employment types."],
  ["totaljobs", "Totaljobs", "totaljobs.com", ["United Kingdom"], "Generalist", "#6e3aaf", "UK jobs from employers and recruitment agencies."],
  ["cvlibrary", "CV-Library", "cv-library.co.uk", ["United Kingdom"], "Generalist", "#0075b4", "UK recruitment with strong permanent and contract coverage."],
  ["monster", "Monster", "monster.com", ["Western Europe"], "Generalist", "#6e37a0", "International opportunities across a range of industries."],
  ["welcome", "Welcome to the Jungle", "welcometothejungle.com", ["France", "United Kingdom"], "Startups & technology", "#e9b527", "Company-focused discovery for technology and modern workplaces."],
  ["hellowork", "HelloWork", "hellowork.com", ["France"], "Generalist", "#e68a2e", "French roles across regions and professional sectors."],
  ["francetravail", "France Travail", "francetravail.fr", ["France"], "Public employment", "#2456a5", "France's national public employment service."],
  ["apec", "Apec", "apec.fr", ["France"], "Professional roles", "#d62953", "Specialist French board for executives and graduate professionals."],
  ["jobsch", "jobs.ch", "jobs.ch", ["Switzerland"], "Generalist", "#d8292f", "Swiss employment opportunities across industries."],
  ["jobup", "jobup.ch", "jobup.ch", ["Switzerland"], "Generalist", "#33859d", "A focus on French-speaking Switzerland."],
  ["irishjobs", "IrishJobs", "irishjobs.ie", ["Ireland"], "Generalist", "#167d77", "Professional and specialist opportunities throughout Ireland."],
  ["jobsie", "Jobs.ie", "jobs.ie", ["Ireland"], "Generalist", "#8b2b91", "Irish employers hiring across services and professional sectors."],
  ["nationale", "Nationale Vacaturebank", "nationalevacaturebank.nl", ["Netherlands"], "Generalist", "#f08d29", "Dutch vacancies from local employers and recruiters."],
  ["intermediair", "Intermediair", "intermediair.nl", ["Netherlands"], "Professional roles", "#a42b6c", "Dutch opportunities for experienced and higher-educated professionals."],
  ["werk", "Werk.nl", "werk.nl", ["Netherlands"], "Public employment", "#176c9e", "The Dutch public employment service from UWV."],
  ["vdab", "VDAB", "vdab.be", ["Belgium"], "Public employment", "#327a49", "Public employment opportunities in Flanders."],
  ["jobat", "Jobat", "jobat.be", ["Belgium"], "Generalist", "#bb2454", "Belgian opportunities in Dutch and French."],
  ["eures", "EURES", "eures.europa.eu", ["Western Europe"], "Public employment", "#215bac", "The European employment network for cross-border opportunities."],
  ["arbeitnow", "Arbeitnow", "arbeitnow.com", ["Germany"], "Technology & more", "#5969df", "Employer-sourced German vacancies with a free public feed."],
  ["remotive", "Remotive", "remotive.com", ["Western Europe", "Remote"], "Remote", "#dd7747", "Remote roles advertising Europe or worldwide eligibility."],
  ["jobicy", "Jobicy", "jobicy.com", ["Western Europe", "Remote"], "Remote", "#9a50b6", "Recent remote roles with European or worldwide eligibility."],
];

export const sources: JobSource[] = definitions.map(
  ([id, name, domain, countries, category, color, description]) => ({
    id, name, domain, countries, category, color, description,
    url: `https://${domain}`,
    initials: name === "LinkedIn" ? "in" : name.split(/[\s.-]/).map(p => p[0]).join("").slice(0, 2).toUpperCase(),
    liveSupported: ["arbeitnow", "remotive", "jobicy"].includes(id),
  }),
);

export interface Filters {
  title?: string;
  city?: string;
  industry?: string;
  offerType?: "all" | "permanent" | "contract";
}

/** Use native query fields where available; unsupported terms remain visible keywords. */
export function searchUrl(source: JobSource, filters: Filters): string {
  const term = [filters.title, filters.industry,
    filters.offerType && filters.offerType !== "all" ? filters.offerType : ""].filter(Boolean).join(" ");
  const city = filters.city ?? "";
  const combined = [term, city].filter(Boolean).join(" ");
  const paths: Record<string, [string, Record<string, string>]> = {
    linkedin: ["https://www.linkedin.com/jobs/search/", { keywords: term, location: city || "Western Europe" }],
    indeed: ["https://www.indeed.com/jobs", { q: term, l: city }],
    glassdoor: ["https://www.glassdoor.com/Job/jobs.htm", { "sc.keyword": combined }],
    stepstone: ["https://www.stepstone.de/jobs", { searchTerm: term, location: city }],
    reed: ["https://www.reed.co.uk/jobs", { keywords: term, location: city }],
    totaljobs: ["https://www.totaljobs.com/jobs", { Keywords: term, Location: city }],
    cvlibrary: ["https://www.cv-library.co.uk/search-jobs", { keywords: term, geo_location: city }],
    monster: ["https://www.monster.com/jobs/search", { q: term, where: city }],
    welcome: ["https://www.welcometothejungle.com/en/jobs", { query: combined }],
    hellowork: ["https://www.hellowork.com/fr-fr/emploi/recherche.html", { k: term, l: city }],
    francetravail: ["https://candidat.francetravail.fr/offres/recherche", { motsCles: combined }],
    apec: ["https://www.apec.fr/candidat/recherche-emploi.html/emploi", { motsCles: combined }],
    jobsch: ["https://www.jobs.ch/en/vacancies/", { term, location: city }],
    jobup: ["https://www.jobup.ch/en/jobs/", { term, location: city }],
    irishjobs: ["https://www.irishjobs.ie/jobs", { Keywords: term, Location: city }],
    jobsie: ["https://www.jobs.ie/jobs", { Keywords: term, Location: city }],
    nationale: ["https://www.nationalevacaturebank.nl/vacatures", { query: term, locatie: city }],
    intermediair: ["https://www.intermediair.nl/vacature/zoeken", { keyword: term, location: city }],
    werk: ["https://www.werk.nl/werkzoekenden/vacatures/", { zoekterm: combined }],
    vdab: ["https://www.vdab.be/vindeenjob/vacatures", { trefwoord: term, locatie: city }],
    jobat: ["https://www.jobat.be/en/jobs", { keywords: term, location: city }],
    eures: ["https://europa.eu/eures/portal/jv-se/search", { keywords: combined }],
    arbeitnow: ["https://www.arbeitnow.com/jobs", { search: combined }],
    remotive: ["https://remotive.com/remote-jobs/search", { search: combined }],
    jobicy: ["https://jobicy.com/jobs", { search: combined }],
  };
  const [base, params] = paths[source.id] ?? [source.url, { q: combined }];
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}
