import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Job, SearchFilters } from '@workspace/api-client-react';

export interface SavedJob {
  job: Job;
  savedAt: string;
  followedUp: boolean;
}

export interface SavedSearch {
  id: string;
  sourceId: string;
  sourceName: string;
  filters: SearchFilters;
  searchUrl: string;
  count: number | null;
  status: string;
  savedAt: string;
  followedUp: boolean;
}

const JOBS_KEY = 'gigfinder.savedJobs.v1';
const SEARCHES_KEY = 'gigfinder.savedSearches.v1';

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function searchKey(sourceId: string, f: SearchFilters) {
  return [sourceId, f.offerType ?? 'all', (f.title ?? '').trim().toLowerCase(), (f.city ?? '').trim().toLowerCase(), (f.industry ?? '').trim().toLowerCase()].join('|');
}

interface Ctx {
  jobs: SavedJob[];
  searches: SavedSearch[];
  isJobSaved: (id: string) => boolean;
  toggleJob: (job: Job) => boolean;
  removeJob: (id: string) => void;
  toggleJobFollowed: (id: string) => void;
  isSearchSaved: (id: string) => boolean;
  toggleSearch: (s: Omit<SavedSearch, 'savedAt' | 'followedUp'>) => boolean;
  removeSearch: (id: string) => void;
  toggleSearchFollowed: (id: string) => void;
  clearAll: () => void;
}

const SavedContext = createContext<Ctx | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<SavedJob[]>(() => read<SavedJob>(JOBS_KEY));
  const [searches, setSearches] = useState<SavedSearch[]>(() => read<SavedSearch>(SEARCHES_KEY));

  useEffect(() => { localStorage.setItem(JOBS_KEY, JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem(SEARCHES_KEY, JSON.stringify(searches)); }, [searches]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === JOBS_KEY) setJobs(read(JOBS_KEY));
      if (e.key === SEARCHES_KEY) setSearches(read(SEARCHES_KEY));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isJobSaved = useCallback((id: string) => jobs.some((j) => j.job.id === id), [jobs]);
  const toggleJob = useCallback((job: Job) => {
    const exists = jobs.some((j) => j.job.id === job.id);
    setJobs((prev) => exists ? prev.filter((j) => j.job.id !== job.id) : [{ job, savedAt: new Date().toISOString(), followedUp: false }, ...prev]);
    return !exists;
  }, [jobs]);
  const removeJob = useCallback((id: string) => setJobs((p) => p.filter((j) => j.job.id !== id)), []);
  const toggleJobFollowed = useCallback((id: string) => setJobs((p) => p.map((j) => j.job.id === id ? { ...j, followedUp: !j.followedUp } : j)), []);

  const isSearchSaved = useCallback((id: string) => searches.some((s) => s.id === id), [searches]);
  const toggleSearch = useCallback((s: Omit<SavedSearch, 'savedAt' | 'followedUp'>) => {
    const exists = searches.some((x) => x.id === s.id);
    setSearches((prev) => exists ? prev.filter((x) => x.id !== s.id) : [{ ...s, savedAt: new Date().toISOString(), followedUp: false }, ...prev]);
    return !exists;
  }, [searches]);
  const removeSearch = useCallback((id: string) => setSearches((p) => p.filter((s) => s.id !== id)), []);
  const toggleSearchFollowed = useCallback((id: string) => setSearches((p) => p.map((s) => s.id === id ? { ...s, followedUp: !s.followedUp } : s)), []);
  const clearAll = useCallback(() => { setJobs([]); setSearches([]); }, []);

  const value = useMemo(() => ({ jobs, searches, isJobSaved, toggleJob, removeJob, toggleJobFollowed, isSearchSaved, toggleSearch, removeSearch, toggleSearchFollowed, clearAll }),
    [jobs, searches, isJobSaved, toggleJob, removeJob, toggleJobFollowed, isSearchSaved, toggleSearch, removeSearch, toggleSearchFollowed, clearAll]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside SavedProvider');
  return ctx;
}
