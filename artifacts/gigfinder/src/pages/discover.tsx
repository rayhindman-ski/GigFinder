import { useMemo, useState, type FormEvent } from 'react';
import { useSearch } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, RotateCcw, AlertTriangle, ExternalLink, Info, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGetSources, type Source, type SearchFiltersOfferType } from '@workspace/api-client-react';
import { useScan, emptyDraft, sameFilters } from '@/hooks/use-scan';
import { useSaved } from '@/hooks/use-saved';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { JobCard, FilterEcho, SourceMark } from '@/components/bits';
import { SourceCard, statusLabel } from '@/components/source-card';
import { cn } from '@/lib/utils';

const OFFER: { v: SearchFiltersOfferType; l: string }[] = [
  { v: 'all', l: 'All' }, { v: 'permanent', l: 'Permanent' }, { v: 'contract', l: 'Contract' },
];

export default function Discover() {
  const { draft, setDraft, result, pendingFilters, isPending, error, scan } = useScan();
  const sourcesQ = useGetSources();
  const { isJobSaved, toggleJob } = useSaved();
  const { toast } = useToast();
  const params = new URLSearchParams(useSearch());
  const [sourceFilter, setSourceFilter] = useState<string | null>(params.get('source'));

  const byId = useMemo(() => {
    const m = new Map<string, Source>();
    (sourcesQ.data ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [sourcesQ.data]);

  const dirty = result ? !sameFilters(draft, result.filters) : false;

  const chartData = useMemo(() => (result?.sources ?? [])
    .filter((r) => r.count !== null)
    .map((r) => ({ id: r.sourceId, name: byId.get(r.sourceId)?.name ?? r.sourceId, count: r.count as number, scope: r.countScope }))
    .sort((a, b) => b.count - a.count), [result, byId]);
  const unknown = useMemo(() => (result?.sources ?? []).filter((r) => r.count === null), [result]);
  const jobs = useMemo(() => (result?.jobs ?? []).filter((j) => !sourceFilter || j.sourceId === sourceFilter), [result, sourceFilter]);
  const returnedBySource = useMemo(() => {
    const m = new Map<string, number>();
    (result?.jobs ?? []).forEach((j) => m.set(j.sourceId, (m.get(j.sourceId) ?? 0) + 1));
    return m;
  }, [result]);

  const submit = (e: FormEvent) => { e.preventDefault(); setSourceFilter(null); scan(draft); };
  const field = (k: 'title' | 'city' | 'industry', label: string, ph: string) => (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input value={draft[k]} maxLength={k === 'title' ? 120 : 100} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} placeholder={ph}
        data-testid={`input-${k}`}
        className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-shadow focus:border-primary focus:ring-4 focus:ring-primary/15" />
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <form onSubmit={submit} className="rounded-3xl bg-secondary p-5 text-secondary-foreground" data-testid="form-filters">
          <h2 className="font-display text-2xl font-extrabold leading-tight">Where's your<br />next role?</h2>
          <p className="mt-1 text-sm opacity-70">Scan live public feeds and line up direct searches on 25 curated boards.</p>
          <div className="mt-5">
            <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">Offer type</span>
            <div className="relative mt-1.5 grid grid-cols-3 rounded-xl bg-background/10 p-1">
              {OFFER.map((o) => (
                <button key={o.v} type="button" onClick={() => setDraft({ ...draft, offerType: o.v })} data-testid={`button-offer-${o.v}`}
                  className={cn('relative rounded-lg py-2 text-xs font-medium transition-colors', draft.offerType === o.v ? 'text-primary-foreground' : 'opacity-70 hover:opacity-100')}>
                  {draft.offerType === o.v && <motion.span layoutId="offer-pill" className="absolute inset-0 rounded-lg bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                  <span className="relative">{o.l}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-3 [&_input]:border-transparent [&_input]:bg-background [&_input]:text-foreground [&_span]:text-secondary-foreground/60">
            {field('title', 'Title', 'e.g. product designer')}
            {field('city', 'City', 'e.g. Amsterdam')}
            {field('industry', 'Industry', 'e.g. fintech')}
          </div>
          <button type="submit" disabled={isPending} data-testid="button-search"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60">
            <Search className={cn('h-4 w-4', isPending && 'animate-spin')} /> {isPending ? 'Scanning feeds…' : 'Search'}
          </button>
          <button type="button" onClick={() => setDraft(emptyDraft)} data-testid="button-reset"
            className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-xs opacity-60 hover:opacity-100">
            <RotateCcw className="h-3 w-3" /> Clear fields
          </button>
          {dirty && !isPending && (
            <p className="mt-2 rounded-lg bg-primary/20 px-3 py-2 text-xs" data-testid="text-filters-dirty">Fields changed. Results below still reflect the previous scan — press Search to update.</p>
          )}
        </form>
      </aside>

      <section className="min-w-0 space-y-6">
        {error && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4" role="alert" data-testid="status-scan-error">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">The scan didn't complete.</div>
              <div className="text-sm text-muted-foreground">{error}{result ? ' Showing the last successful scan.' : ''}</div>
            </div>
            <button onClick={() => scan(pendingFilters ?? draft)} data-testid="button-retry-scan" className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">Retry scan</button>
          </div>
        )}

        {/* Stats */}
        <div className="rise grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Observed matches" testId="stat-total" value={result && !isPending ? result.totalMatches.toLocaleString() : null} loading={isPending} note="in public feeds" accent />
          <Stat label="Live coverage" testId="stat-live" value={result && !isPending ? `${result.liveSources} / ${result.sources.length}` : null} loading={isPending} note="sources with feed counts" />
          <Stat label="Job cards returned" testId="stat-returned" value={result && !isPending ? result.jobs.length.toLocaleString() : null} loading={isPending} note="up to 200 per scan" />
          <Stat label="Scanned" testId="stat-scanned" value={result && !isPending ? new Date(result.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null} loading={isPending} note={result ? new Date(result.scannedAt).toLocaleString() : 'awaiting first scan'} />
        </div>

        {result && !isPending && (
          <div className="flex flex-wrap items-start gap-3 rounded-2xl border bg-card p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#61A9BD]" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm" data-testid="text-notice">{result.notice}</p>
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] text-muted-foreground">Results for</span><FilterEcho filters={result.filters} /></div>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="rounded-3xl border bg-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-extrabold">Where the matches are</h2>
              <p className="text-sm text-muted-foreground">Observed matches per live public feed — a sample of each feed, not a board's full inventory.</p>
            </div>
          </div>
          {isPending ? (
            <div className="mt-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" style={{ width: `${80 - i * 20}%` }} />)}<p className="font-mono text-xs text-muted-foreground">Scanning for: {pendingFilters?.title || 'any title'} · {pendingFilters?.city || 'any city'} · {pendingFilters?.offerType}</p></div>
          ) : !result ? (
            <p className="mt-6 rounded-xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">No scan results yet. Press Search to count observed matches.</p>
          ) : chartData.length === 0 ? (
            <p className="mt-6 rounded-xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">No live feed returned a numeric count for this scan.</p>
          ) : (
            <div className="mt-4" style={{ height: Math.max(140, chartData.length * 52) }} data-testid="chart-source-counts">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 'auto']} allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'Spline Sans Mono' }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof chartData)[number];
                    return (
                      <div className="max-w-xs rounded-xl border bg-popover p-3 text-xs shadow-lg">
                        <div className="font-medium">{p.name}</div>
                        <div className="font-mono text-base">{p.count.toLocaleString()} observed matches</div>
                        <div className="mt-1 text-muted-foreground">{p.scope}</div>
                      </div>
                    );
                  }} />
                  <Bar dataKey="count" fill="#61A9BD" radius={[0, 6, 6, 0]} barSize={26} onClick={(d: { id?: string }) => d?.id && setSourceFilter(d.id)} className="cursor-pointer">
                    <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontFamily: 'Spline Sans Mono', fill: 'hsl(var(--foreground))' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {result && !isPending && unknown.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Count unknown ({unknown.length}) — excluded from chart, not zero</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {unknown.map((r) => {
                  const s = byId.get(r.sourceId); const st = statusLabel(r);
                  return (
                    <li key={r.sourceId} className="flex items-center gap-3 rounded-xl border border-dashed p-2.5" data-testid={`row-unknown-${r.sourceId}`}>
                      <SourceMark source={s} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{s?.name ?? r.sourceId}</span><span className={cn('rounded-full px-1.5 font-mono text-[9px] uppercase', st.cls)}>{st.text}</span></div>
                        <div className="truncate text-xs text-muted-foreground" title={r.message}>{r.message}</div>
                      </div>
                      <a href={r.searchUrl} target="_blank" rel="noreferrer" data-testid={`link-direct-${r.sourceId}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border hover:border-primary hover:text-primary" aria-label={`Search on ${s?.name ?? r.sourceId}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Live source cards */}
        {result && !isPending && sourcesQ.data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.sources.filter((r) => r.count !== null).map((r, i) => {
              const s = byId.get(r.sourceId);
              return s ? <SourceCard key={r.sourceId} source={s} result={r} scan={result} index={i} onShowJobs={() => setSourceFilter(r.sourceId)} /> : null;
            })}
          </div>
        )}

        {/* Jobs */}
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-extrabold">Live listings</h2>
              <p className="text-sm text-muted-foreground">Records from public feeds. Heart a role to keep it for follow-up.</p>
            </div>
            {result && !isPending && result.jobs.length > 0 && (
              <div className="flex flex-wrap gap-1.5" data-testid="group-source-filter">
                <Chip active={!sourceFilter} onClick={() => setSourceFilter(null)} testId="button-source-all">All · {result.jobs.length}</Chip>
                {[...returnedBySource.entries()].map(([id, n]) => (
                  <Chip key={id} active={sourceFilter === id} onClick={() => setSourceFilter(id)} testId={`button-source-${id}`}>{byId.get(id)?.name ?? id} · {n}</Chip>
                ))}
              </div>
            )}
          </div>
          {sourceFilter && result && (
            <button onClick={() => setSourceFilter(null)} className="mt-3 inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs" data-testid="button-clear-source">
              Showing {byId.get(sourceFilter)?.name ?? sourceFilter} only <X className="h-3 w-3" />
            </button>
          )}
          <div className="mt-4 space-y-3">
            {isPending ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
            ) : !result ? (
              <Empty title={error ? 'No results to show yet' : 'Preparing your first scan'} body="Listings appear here only after a scan returns live public feed records." />
            ) : jobs.length === 0 ? (
              <Empty title="No live listings for these filters" body="Try a broader title or drop the city. Boards without public feeds may still have matches — use their direct search links above." />
            ) : (
              <AnimatePresence mode="popLayout">
                {jobs.map((j, i) => (
                  <JobCard key={j.id} job={j} index={i} source={byId.get(j.sourceId)} saved={isJobSaved(j.id)}
                    onToggle={() => { const added = toggleJob(j); toast({ title: added ? 'Saved for follow-up' : 'Removed from saved', description: j.title }); }} />
                ))}
              </AnimatePresence>
            )}
            {result && !isPending && result.totalMatches > result.jobs.length && (
              <p className="pt-2 text-center font-mono text-xs text-muted-foreground">{result.totalMatches.toLocaleString()} observed matches · {result.jobs.length} job cards returned by this scan</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note, loading, accent, testId }: { label: string; value: string | null; note: string; loading: boolean; accent?: boolean; testId: string }) {
  return (
    <div className={cn('ticket-edge rounded-2xl border p-4', accent ? 'bg-primary text-primary-foreground border-primary' : 'bg-card')}>
      <div className={cn('font-mono text-[10px] uppercase tracking-wider', accent ? 'opacity-80' : 'text-muted-foreground')}>{label}</div>
      <div className="mt-1 h-9 font-display text-2xl font-extrabold tabular-nums sm:text-3xl" data-testid={testId}>
        {loading ? <Skeleton className={cn('h-8 w-20', accent && 'bg-primary-foreground/25')} /> : value ?? '—'}
      </div>
      <div className={cn('mt-1 truncate text-xs', accent ? 'opacity-80' : 'text-muted-foreground')}>{note}</div>
    </div>
  );
}

function Chip({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className={cn('rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors', active ? 'border-secondary bg-secondary text-secondary-foreground' : 'bg-card hover:border-foreground/40')}>
      {children}
    </button>
  );
}

export function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
