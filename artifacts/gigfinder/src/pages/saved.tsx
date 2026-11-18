import { useMemo } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Trash2, Check } from 'lucide-react';
import { useGetSources, type Source } from '@workspace/api-client-react';
import { useSaved } from '@/hooks/use-saved';
import { JobCard, FilterEcho, SourceMark, BrowserOnlyNote, timeAgo } from '@/components/bits';
import { Empty } from './discover';
import { cn } from '@/lib/utils';

export default function Saved() {
  const { jobs, searches, toggleJob, removeJob, toggleJobFollowed, removeSearch, toggleSearchFollowed } = useSaved();
  const { data: sources } = useGetSources();
  const byId = useMemo(() => {
    const m = new Map<string, Source>();
    (sources ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [sources]);
  const open = jobs.filter((j) => !j.followedUp).length + searches.filter((s) => !s.followedUp).length;

  return (
    <div className="space-y-8">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Follow-up list</h1>
          <p className="mt-1 text-muted-foreground"><span className="font-mono text-primary" data-testid="text-open-count">{open}</span> waiting on you · {jobs.length} roles · {searches.length} searches</p>
        </div>
        <BrowserOnlyNote />
      </header>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Saved roles</h2>
        <div className="mt-3 space-y-3">
          {jobs.length === 0 ? (
            <Empty title="No saved roles yet" body="Heart a listing on Discover and it lands here, ready for follow-up.">
              <Link href="/" className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" data-testid="link-go-discover">Go to Discover</Link>
            </Empty>
          ) : (
            <AnimatePresence mode="popLayout">
              {jobs.map((s, i) => (
                <JobCard key={s.job.id} index={i} job={s.job} source={byId.get(s.job.sourceId)} saved onToggle={() => toggleJob(s.job)}
                  followedUp={s.followedUp} onFollowed={() => toggleJobFollowed(s.job.id)} onRemove={() => removeJob(s.job.id)} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Saved source searches</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {searches.length === 0 ? (
            <div className="md:col-span-2"><Empty title="No saved searches" body="On any source card, press Save search to keep that board's search for the current filters." /></div>
          ) : (
            <AnimatePresence mode="popLayout">
              {searches.map((s) => (
                <motion.div key={s.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -20 }}
                  className={cn('rounded-2xl border bg-card p-4', s.followedUp && 'opacity-70')} data-testid={`card-saved-search-${s.sourceId}`}>
                  <div className="flex items-center gap-3">
                    <SourceMark source={byId.get(s.sourceId)} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-lg font-bold">{s.sourceName}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {s.count !== null ? `${s.count.toLocaleString()} observed at save time` : 'count unknown — direct search'} · saved {timeAgo(s.savedAt)}
                      </div>
                    </div>
                  </div>
                  <FilterEcho filters={s.filters} className="mt-3" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={s.searchUrl} target="_blank" rel="noreferrer" data-testid={`link-saved-search-${s.sourceId}`} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-xs font-medium text-secondary-foreground">Open search <ExternalLink className="h-3 w-3" /></a>
                    <button onClick={() => toggleSearchFollowed(s.id)} data-testid={`button-followed-search-${s.sourceId}`} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium', s.followedUp && 'border-[#61A9BD] bg-[#61A9BD]/15')}>
                      <Check className="h-3 w-3" /> {s.followedUp ? 'Followed up' : 'Mark followed up'}
                    </button>
                    <button onClick={() => removeSearch(s.id)} data-testid={`button-remove-search-${s.sourceId}`} className="ml-auto inline-flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>
    </div>
  );
}
