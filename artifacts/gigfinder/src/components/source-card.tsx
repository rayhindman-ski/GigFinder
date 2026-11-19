import { motion } from 'framer-motion';
import { ExternalLink, Bookmark, BookmarkCheck, ListFilter } from 'lucide-react';
import type { ScanResult, Source, SourceResult } from '@workspace/api-client-react';
import { useSaved, searchKey } from '@/hooks/use-saved';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SourceMark, timeAgo } from './bits';

export function statusLabel(r?: SourceResult) {
  if (!r) return { text: 'not scanned', cls: 'bg-muted text-muted-foreground' };
  if (r.status === 'live' && r.count !== null) return { text: 'live feed', cls: 'bg-[#61A9BD]/15 text-[hsl(196_45%_26%)] dark:text-[#9fd0dd]' };
  if (r.status === 'unavailable') return { text: 'unavailable', cls: 'bg-destructive/10 text-destructive' };
  return { text: 'direct search', cls: 'bg-primary/10 text-primary' };
}

export function SourceCard({ source, result, scan, onShowJobs, index = 0 }: {
  source: Source; result?: SourceResult; scan: ScanResult | null; onShowJobs?: () => void; index?: number;
}) {
  const { isSearchSaved, toggleSearch } = useSaved();
  const { toast } = useToast();
  const key = scan ? searchKey(source.id, scan.filters) : null;
  const saved = key ? isSearchSaved(key) : false;
  const st = statusLabel(result);
  const link = result?.searchUrl || source.url;

  const onSave = () => {
    if (!scan || !key) return;
    const added = toggleSearch({ id: key, sourceId: source.id, sourceName: source.name, filters: scan.filters, searchUrl: link, count: result?.count ?? null, status: result?.status ?? 'direct' });
    toast({ title: added ? 'Search saved for follow-up' : 'Saved search removed', description: `${source.name} — kept in this browser only.` });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(index, 20) * 0.02 }}
      data-testid={`card-source-${source.id}`}
      className="flex flex-col rounded-2xl border bg-card p-5"
    >
      <div className="flex items-start gap-3">
        <SourceMark source={source} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-lg font-bold">{source.name}</h3>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider', st.cls)} data-testid={`status-source-${source.id}`}>{st.text}</span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">{source.domain} · {source.category}</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{source.description}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {source.countries.map((c) => <span key={c} className="rounded border px-1.5 py-0.5 font-mono text-[10px]">{c}</span>)}
      </div>

      <div className="mt-4 rounded-xl bg-muted/60 p-3">
        {result ? (
          result.count !== null ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold tabular-nums" data-testid={`text-count-${source.id}`}>{result.count.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">observed matches</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{result.countScope}</p>
            </div>
          ) : (
            <div>
              <div className="font-mono text-xs font-medium">Count unknown — not zero</div>
              <p className="mt-1 text-xs text-muted-foreground">{result.message}</p>
            </div>
          )
        ) : (
          <p className="text-xs text-muted-foreground">
            {source.liveSupported ? 'Public feed supported. Run a scan to see observed matches.' : 'No public feed access. Use the direct search link on the board itself.'}
          </p>
        )}
        {result?.checkedAt && <p className="mt-1 font-mono text-[10px] text-muted-foreground">checked {timeAgo(result.checkedAt)}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
        <a href={link} target="_blank" rel="noreferrer" data-testid={`link-source-search-${source.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-xs font-medium text-secondary-foreground transition-transform hover:-translate-y-0.5">
          {result ? 'Search on board' : 'Visit board'} <ExternalLink className="h-3 w-3" />
        </a>
        {onShowJobs && result?.count ? (
          <button type="button" onClick={onShowJobs} data-testid={`button-show-jobs-${source.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium hover:border-foreground/40">
            <ListFilter className="h-3 w-3" /> Jobs from this source
          </button>
        ) : null}
        <button type="button" onClick={onSave} disabled={!scan} data-testid={`button-save-search-${source.id}`}
          title={scan ? 'Save this search for follow-up' : 'Run a scan first to save a search'}
          className={cn('ml-auto inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            saved ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary hover:text-primary')}>
          <motion.span key={String(saved)} initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
            {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          </motion.span>
          {saved ? 'Search saved' : 'Save search'}
        </button>
      </div>
    </motion.div>
  );
}
