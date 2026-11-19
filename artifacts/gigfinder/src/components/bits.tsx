import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, ExternalLink, MapPin, Building2, Trash2, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Job, SearchFilters, Source } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { RoleAssessmentControl } from '@/components/role-assessment';

export function SourceMark({ source, size = 36 }: { source?: Source; size?: number }) {
  return (
    <div
      className="shrink-0 grid place-items-center rounded-lg font-mono text-[11px] font-medium text-[hsl(40_40%_98%)]"
      style={{ width: size, height: size, background: source?.color || 'hsl(228 38% 14%)' }}
      aria-hidden
    >
      {source?.initials ?? '··'}
    </div>
  );
}

const BURST = Array.from({ length: 8 }, (_, i) => i);

export function HeartButton({ active, onToggle, label, testId, size = 'md' }: { active: boolean; onToggle: () => void; label: string; testId: string; size?: 'sm' | 'md' }) {
  const [burstKey, setBurstKey] = useState(0);
  const dim = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      aria-label={active ? `Remove ${label} from follow-up` : `Save ${label} for follow-up`}
      title={active ? 'Saved for follow-up' : 'Save for follow-up'}
      onClick={() => { if (!active) setBurstKey((k) => k + 1); onToggle(); }}
      className={cn('relative grid place-items-center rounded-full border transition-colors duration-300', dim,
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/50')}
    >
      <AnimatePresence>
        {burstKey > 0 && active && (
          <motion.span key={burstKey} className="absolute inset-0 pointer-events-none" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }}>
            {BURST.map((i) => {
              const a = (i / BURST.length) * Math.PI * 2;
              return (
                <motion.span key={i} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -ml-[3px] -mt-[3px] rounded-full"
                  style={{ background: i % 2 ? '#61A9BD' : 'hsl(var(--primary))' }}
                  initial={{ x: 0, y: 0, scale: 1 }} animate={{ x: Math.cos(a) * 22, y: Math.sin(a) * 22, scale: 0 }}
                  transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
              );
            })}
            <motion.span className="absolute inset-0 rounded-full border-2 border-primary" initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.5 }} />
          </motion.span>
        )}
      </AnimatePresence>
      <motion.span key={active ? 'on' : 'off'} initial={{ scale: active ? 0.4 : 1.2 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 14 }}>
        <Heart className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} fill={active ? 'currentColor' : 'none'} strokeWidth={2} />
      </motion.span>
    </button>
  );
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export function JobCard({ job, source, saved, onToggle, followedUp, onFollowed, onRemove, index = 0 }: {
  job: Job; source?: Source; saved: boolean; onToggle: () => void; followedUp?: boolean; onFollowed?: () => void; onRemove?: () => void; index?: number;
}) {
  const desc = stripHtml(job.description || '');
  const posted = timeAgo(job.publishedAt);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.03 }}
      data-testid={`card-job-${job.id}`}
      className={cn('group relative rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[0_10px_30px_-18px_hsl(228_38%_14%/0.45)]', followedUp && 'opacity-70')}
    >
      <div className="flex gap-4">
        <SourceMark source={source} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>{source?.name ?? job.sourceId}</span>
            {posted && <><span aria-hidden>/</span><span>{posted}</span></>}
          </div>
          <h3 className="mt-1 font-display text-lg font-bold leading-snug" data-testid={`text-job-title-${job.id}`}>{job.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {job.company && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{job.company}</span>}
            {job.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.offerType && <Tag tone="primary">{job.offerType}</Tag>}
            {job.remote && <Tag tone="cyan">remote</Tag>}
            {job.industry && <Tag>{job.industry}</Tag>}
          </div>
          {desc && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground/90">{desc}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a href={job.url} target="_blank" rel="noreferrer" data-testid={`link-job-${job.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-transform hover:-translate-y-0.5">
              Open listing <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {onFollowed && (
              <button type="button" onClick={onFollowed} data-testid={`button-followed-${job.id}`}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors', followedUp ? 'border-[#61A9BD] bg-[#61A9BD]/15 text-[hsl(196_45%_22%)] dark:text-[#9fd0dd]' : 'hover:border-foreground/40')}>
                <Check className="h-3.5 w-3.5" /> {followedUp ? 'Followed up' : 'Mark followed up'}
              </button>
            )}
            {onRemove && (
              <button type="button" onClick={onRemove} data-testid={`button-remove-job-${job.id}`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          <div className="mt-3"><RoleAssessmentControl job={job} /></div>
        </div>
        <HeartButton active={saved} onToggle={onToggle} label={job.title} testId={`button-save-job-${job.id}`} />
      </div>
    </motion.article>
  );
}

export function Tag({ children, tone }: { children: React.ReactNode; tone?: 'primary' | 'cyan' }) {
  return (
    <span className={cn('rounded-md px-2 py-0.5 font-mono text-[11px] lowercase',
      tone === 'primary' ? 'bg-primary/10 text-primary' : tone === 'cyan' ? 'bg-[#61A9BD]/15 text-[hsl(196_45%_28%)] dark:text-[#9fd0dd]' : 'bg-muted text-muted-foreground')}>
      {children}
    </span>
  );
}

export function FilterEcho({ filters, className }: { filters: SearchFilters; className?: string }) {
  const parts: [string, string][] = [
    ['type', filters.offerType ?? 'all'],
    ['title', filters.title?.trim() || 'any'],
    ['city', filters.city?.trim() || 'any'],
    ['industry', filters.industry?.trim() || 'any'],
  ];
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} data-testid="text-filter-echo">
      {parts.map(([k, v]) => (
        <span key={k} className="rounded-full border bg-card px-2.5 py-1 font-mono text-[11px]">
          <span className="text-muted-foreground">{k}:</span> {v}
        </span>
      ))}
    </div>
  );
}

export function BrowserOnlyNote() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground" data-testid="text-browser-only">
      <span className="h-1.5 w-1.5 rounded-full bg-[#61A9BD]" /> Stored in this browser only
    </span>
  );
}
