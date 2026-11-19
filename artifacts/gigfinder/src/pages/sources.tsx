import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { AlertTriangle } from 'lucide-react';
import { useGetSources, getGetSourcesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useScan } from '@/hooks/use-scan';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterEcho } from '@/components/bits';
import { SourceCard } from '@/components/source-card';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'live' | 'direct';

export default function Sources() {
  const q = useGetSources();
  const qc = useQueryClient();
  const { result, isPending } = useScan();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>('all');

  const list = useMemo(() => (q.data ?? []).filter((s) => tab === 'all' || (tab === 'live' ? s.liveSupported : !s.liveSupported)), [q.data, tab]);
  const liveCount = (q.data ?? []).filter((s) => s.liveSupported).length;
  const total = q.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <header className="rise grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">The board directory</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">A curated set of leading job boards for Western Europe — chosen for relevance, not an audited traffic ranking.</p>
        </div>
        <div className="rounded-3xl bg-secondary p-5 text-secondary-foreground">
          <h2 className="font-mono text-[11px] uppercase tracking-wider opacity-60">How coverage works</h2>
          <p className="mt-2 text-sm"><b className="text-[#8cc6d6]">{q.data ? liveCount : '—'} boards</b> expose a public feed we can read live; counts are observed matches in that feed, not the board's full inventory.</p>
          <p className="mt-2 text-sm"><b className="text-primary">{q.data ? total - liveCount : '—'} boards</b> restrict API access. We never guess their numbers — you get a direct search link with your filters instead.</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border bg-card p-1">
          {(['all', 'live', 'direct'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} data-testid={`button-tab-${t}`}
              className={cn('rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors', tab === t ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground')}>
              {t === 'direct' ? 'Direct search' : t === 'live' ? 'Live feeds' : 'All'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {isPending ? 'Scan in progress…' : result ? <><span className="font-mono">Save search uses:</span><FilterEcho filters={result.filters} /></> : 'Run a scan on Discover to enable saving searches.'}
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
      ) : q.isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5" role="alert">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div className="flex-1"><div className="font-medium">Couldn't load the board directory.</div><div className="text-sm text-muted-foreground">Check your connection and try again.</div></div>
          <button onClick={() => qc.invalidateQueries({ queryKey: getGetSourcesQueryKey() })} data-testid="button-retry-sources" className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">Retry</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => (
            <SourceCard key={s.id} source={s} index={i} scan={isPending ? null : result}
              result={isPending ? undefined : result?.sources.find((r) => r.sourceId === s.id)}
              onShowJobs={() => navigate(`/?source=${encodeURIComponent(s.id)}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
