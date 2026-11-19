import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Crosshair, Check, RotateCw, ArrowUpRight, AlertTriangle, X, ExternalLink } from 'lucide-react';
import type { Job, RoleAssessment, RoleFitAlignment } from '@workspace/api-client-react';
import { useCv, MAX_ROLES, type RoleSel } from '@/hooks/use-cv';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const ALIGN: Record<RoleFitAlignment, { label: string; cls: string; bar: number }> = {
  strong: { label: 'Strong fit', cls: 'bg-[#61A9BD]/20 text-[hsl(196_45%_22%)] dark:text-[#9fd0dd] border-[#61A9BD]/60', bar: 4 },
  partial: { label: 'Partial fit', cls: 'bg-[hsl(42_80%_55%/0.2)] text-[hsl(36_70%_28%)] border-[hsl(42_80%_55%/0.6)]', bar: 3 },
  limited: { label: 'Limited fit', cls: 'bg-primary/10 text-primary border-primary/40', bar: 2 },
  insufficient: { label: 'Not enough evidence', cls: 'bg-muted text-muted-foreground border-border', bar: 1 },
};

export function AlignmentBadge({ alignment, testId }: { alignment: RoleFitAlignment; testId?: string }) {
  const a = ALIGN[alignment];
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[11px]', a.cls)} data-testid={testId}>
      <span className="flex gap-0.5" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={cn('h-2.5 w-1 rounded-full', i <= a.bar ? 'bg-current' : 'bg-current/20 opacity-25')} />)}</span>
      {a.label}
    </span>
  );
}

export function RoleStatusPill({ role }: { role: RoleSel }) {
  if (role.status === 'done' && role.assessment) return <AlignmentBadge alignment={role.assessment.fit.alignment} testId={`status-fit-${role.jobId}`} />;
  if (role.status === 'error') return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 font-mono text-[11px] text-destructive" data-testid={`status-fit-${role.jobId}`}><AlertTriangle className="h-3 w-3" /> failed</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground', role.status === 'pending' && 'sweep border-primary/40 text-foreground')} data-testid={`status-fit-${role.jobId}`} role="status">
      <span className={cn('h-1.5 w-1.5 rounded-full', role.status === 'pending' ? 'animate-pulse bg-primary' : 'bg-muted-foreground/50')} />
      {role.status === 'pending' ? 'assessing' : 'queued'}
    </span>
  );
}

/** Lives inside JobCard. Independent from the follow-up heart. */
export function RoleAssessmentControl({ job }: { job: Job }) {
  const { signedIn, allowed, session, roleFor, toggleRole, retryRole, roles } = useCv();
  const { toast } = useToast();
  if (!signedIn || !allowed) return null;
  const role = roleFor(job.id);

  if (!session) {
    return (
      <Link href="/cv" data-testid={`link-pick-cv-${job.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3.5 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary">
        <Crosshair className="h-3.5 w-3.5" /> Pick a CV to compare
      </Link>
    );
  }

  const onToggle = () => {
    const r = toggleRole(job);
    if (r === 'limit') toast({ title: `Up to ${MAX_ROLES} roles at a time`, description: 'Deselect a role before adding another.' });
  };
  const atLimit = !role && roles.length >= MAX_ROLES;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={`control-assess-${job.id}`}>
      <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={onToggle} aria-pressed={!!role} aria-disabled={atLimit}
        title={atLimit ? `Limit of ${MAX_ROLES} selected roles reached` : undefined}
        data-testid={`button-assess-${job.id}`}
        className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
          role ? 'border-secondary bg-secondary/5 text-foreground' : 'hover:border-primary hover:text-primary', atLimit && 'opacity-50')}>
        {role ? <Check className="h-3.5 w-3.5" /> : <Crosshair className="h-3.5 w-3.5" />}
        {role ? 'Comparing to CV' : 'Compare to CV'}
      </motion.button>
      {role && <RoleStatusPill role={role} />}
      {role?.status === 'error' && (
        <button type="button" onClick={() => retryRole(job.id)} data-testid={`button-retry-assess-${job.id}`} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-destructive hover:underline">
          <RotateCw className="h-3 w-3" /> Retry
        </button>
      )}
      {role && role.status !== 'error' && (
        <Link href={`/cv?role=${encodeURIComponent(job.id)}`} data-testid={`link-assessment-${job.id}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          {role.status === 'done' ? 'Read assessment' : 'Open in CV workspace'} <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
      {role?.status === 'error' && role.error && <p className="basis-full text-xs text-destructive" role="alert">{role.error}</p>}
    </div>
  );
}

export function AssessmentDetail({ a }: { a: RoleAssessment }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-[15px] leading-relaxed" data-testid={`text-fit-summary-${a.jobId}`}>{a.fit.summary}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="font-mono text-[11px] uppercase tracking-wider text-[hsl(196_45%_28%)] dark:text-[#9fd0dd]">Strengths evidenced in your CV</h4>
          {a.fit.strengths.length === 0 ? <p className="mt-2 text-muted-foreground">No clear matching evidence found.</p> : (
            <ul className="mt-2 space-y-2">
              {a.fit.strengths.map((s, i) => (
                <li key={i} className="rounded-xl border-l-2 border-[#61A9BD] bg-[#61A9BD]/8 px-3 py-2">
                  <div className="font-medium">{s.skill}</div>
                  <div className="mt-0.5 text-xs italic text-muted-foreground">"{s.evidence}"</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="font-mono text-[11px] uppercase tracking-wider text-primary">Gaps</h4>
            {a.fit.gaps.length === 0 ? <p className="mt-2 text-muted-foreground">No gaps named.</p> : (
              <ul className="mt-2 space-y-1.5">{a.fit.gaps.map((g, i) => <li key={i} className="flex gap-2"><X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{g}</li>)}</ul>
            )}
          </div>
          {a.fit.suggestions.length > 0 && (
            <div>
              <h4 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Worth doing before applying</h4>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">{a.fit.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
        {a.limitation && <span className="min-w-0 flex-1"><span className="mb-1 block font-mono text-[11px] uppercase">Assessment limitations</span>{a.limitation}</span>}
        <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary" data-testid={`link-assessed-role-${a.jobId}`}>Open listing <ExternalLink className="h-3 w-3" /></a>
      </div>
    </div>
  );
}
