import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Show } from '@clerk/react';
import {
  FileText, Search, ExternalLink, ChevronLeft, ChevronRight, ShieldCheck, Lock, AlertTriangle, Info, RotateCw, X, Clock, Sparkles, FolderOpen, Crosshair,
} from 'lucide-react';
import { useListCvFiles, getListCvFilesQueryKey, type CvFile, type CvSkillCategory, type ListCvFilesParams } from '@workspace/api-client-react';
import { useCv, MAX_ROLES } from '@/hooks/use-cv';
import { useScan } from '@/hooks/use-scan';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { AssessmentDetail, RoleStatusPill } from '@/components/role-assessment';
import { timeAgo } from '@/components/bits';
import { describeCvError } from '@/lib/cv-errors';
import { cn } from '@/lib/utils';

const CATS: { k: CvSkillCategory; l: string; dot: string }[] = [
  { k: 'technical', l: 'Technical', dot: 'bg-[#61A9BD]' },
  { k: 'domain', l: 'Domain', dot: 'bg-[hsl(42_80%_55%)]' },
  { k: 'leadership', l: 'Leadership', dot: 'bg-primary' },
  { k: 'language', l: 'Languages', dot: 'bg-[hsl(160_30%_45%)]' },
  { k: 'other', l: 'Other', dot: 'bg-muted-foreground' },
];

export default function CvPage() {
  return (
    <>
      <Show when="signed-out"><SignedOutInvite /></Show>
      <Show when="signed-in"><Workspace /></Show>
    </>
  );
}

function SignedOutInvite() {
  return (
    <div className="rise mx-auto max-w-2xl py-10">
      <div className="overflow-hidden rounded-3xl bg-secondary text-secondary-foreground">
        <div className="p-7 sm:p-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider"><Lock className="h-3 w-3" /> private workspace</span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">Hold your CV up<br />against the roles you found.</h1>
          <p className="mt-4 max-w-md opacity-75">Pick a CV from your Drive, see the skills it actually evidences, then check listings from Discover or Saved for strengths and gaps. Only the owner of the connected Drive can open this space.</p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/sign-in" data-testid="link-cv-sign-in" className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">Sign in to continue</Link>
            <Link href="/discover" data-testid="link-cv-discover" className="rounded-full border border-secondary-foreground/25 px-5 py-2.5 text-sm font-medium hover:border-secondary-foreground/60">Keep browsing roles</Link>
          </div>
        </div>
        <div className="ticket-edge border-t border-dashed border-secondary-foreground/20 bg-background/5 px-7 py-4 font-mono text-[11px] opacity-70 sm:px-10">Discovery, saved roles and sources stay open without an account.</div>
      </div>
    </div>
  );
}

function Workspace() {
  const cv = useCv();
  if (cv.accessLoading) {
    return <div className="space-y-4"><Skeleton className="h-28 rounded-3xl" /><div className="grid gap-4 lg:grid-cols-[380px_1fr]"><Skeleton className="h-96 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div></div>;
  }
  if (cv.accessError) {
    return (
      <Panel tone="error" icon={<AlertTriangle className="h-5 w-5" />} title="Couldn't check access to the CV workspace" body={cv.accessError} testId="status-cv-access-error">
        <button onClick={cv.refetchAccess} data-testid="button-retry-access" className="mt-4 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">Try again</button>
      </Panel>
    );
  }
  if (!cv.allowed) {
    return (
      <Panel icon={<Lock className="h-5 w-5" />} title="This workspace belongs to someone else's Drive" testId="status-cv-denied"
        body={cv.access?.message || 'Only the verified owner of the connected Google Drive can open CVs here.'}>
        <p className="mt-3 text-sm text-muted-foreground">If this is your Drive, sign in with the email address that owns it and make sure it is verified. Discovery and your saved list keep working either way.</p>
        <Link href="/discover" className="mt-4 inline-flex rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground" data-testid="link-denied-discover">Back to Discover</Link>
      </Panel>
    );
  }
  return <AllowedWorkspace />;
}

function AllowedWorkspace() {
  const cv = useCv();
  return (
    <div className="space-y-6">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">private · this tab only</span>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">CV workspace</h1>
        </div>
        <Disclosure />
      </header>

      <AnimatePresence>
        {cv.notice && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} role="alert" data-testid="status-cv-notice"
            className="flex items-start gap-3 rounded-2xl border border-[hsl(42_80%_55%/0.6)] bg-[hsl(42_80%_55%/0.12)] p-4">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm">{cv.notice}</p>
            <button onClick={cv.dismissNotice} aria-label="Dismiss" data-testid="button-dismiss-notice" className="rounded-full p-1 hover:bg-background/60"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <FilePicker />
        <div className="min-w-0 space-y-6">
          <SelectedCv />
          {cv.session && <RolesBoard />}
        </div>
      </div>
    </div>
  );
}

function Disclosure() {
  return (
    <div className="max-w-md rounded-2xl border bg-card p-3.5 text-xs leading-relaxed text-muted-foreground" data-testid="text-ai-disclosure">
      <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><ShieldCheck className="h-3.5 w-3.5 text-[#61A9BD]" /> What leaves your Drive</div>
      Only the CV you select is sent to the AI model, and each analysis or assessment uses billed credits. Results are advisory, not a hiring verdict. The server holds them in memory for a fixed 30 minutes; a server restart clears them sooner.
    </div>
  );
}

function useDebounced(v: string, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = window.setTimeout(() => setD(v), ms); return () => window.clearTimeout(t); }, [v, ms]);
  return d;
}

function FilePicker() {
  const cv = useCv();
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim(), 350);
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined]);
  useEffect(() => { setTokens([undefined]); }, [search]);
  const page = tokens.length - 1;
  const params: ListCvFilesParams = { ...(search ? { search } : {}), ...(tokens[page] ? { pageToken: tokens[page] } : {}) };
  const filesQ = useListCvFiles(params, { query: { enabled: cv.allowed, queryKey: getListCvFilesQueryKey(params), retry: false, staleTime: 60_000 } });
  const data = filesQ.data;
  const err = filesQ.error ? describeCvError(filesQ.error, 'files').message : null;

  return (
    <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-3xl bg-secondary p-5 text-secondary-foreground">
        <h2 className="font-display text-2xl font-extrabold">Your CV folders</h2>
        <p className="mt-1 text-sm opacity-70">Documents sitting directly inside Drive folders named CV.</p>
        <label className="relative mt-4 block">
          <span className="sr-only">Search CV documents</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={120} placeholder="Search by file name" data-testid="input-cv-search" type="search"
            className="w-full rounded-xl bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none focus:ring-4 focus:ring-primary/30" />
        </label>
        <p className="mt-3 font-mono text-[10px] leading-relaxed opacity-60">Reads Google Docs, PDF, DOCX, plain text and Markdown. Images are not supported; scanned PDFs without a text layer fail with an explicit error.</p>
      </div>

      <div className="mt-3 min-w-0 space-y-2" aria-busy={filesQ.isFetching}>
        {filesQ.isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-2xl" />)
        ) : err ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert" data-testid="status-files-error">
            <div className="font-medium">Drive didn't answer.</div>
            <p className="mt-0.5 text-muted-foreground">{err}</p>
            <button onClick={() => filesQ.refetch()} data-testid="button-retry-files" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-1.5 text-xs font-medium text-destructive-foreground"><RotateCw className="h-3 w-3" /> Retry</button>
          </div>
        ) : data ? (
          <>
            <p className="flex items-start gap-2 rounded-xl bg-muted/70 px-3 py-2 text-xs text-muted-foreground" data-testid="text-files-notice">
              <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{data.notice} <span className="font-mono">{data.folderCount} CV folder{data.folderCount === 1 ? '' : 's'}</span> · subfolders are not searched.</span>
            </p>
            {data.files.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="text-files-empty">
                {data.folderCount === 0 ? 'No folder named CV found in your Drive. Create one and place your CV directly inside it.' : search ? `Nothing matches "${search}".` : 'Your CV folders are empty.'}
              </div>
            ) : (
              <ul className={cn('min-w-0 space-y-2 transition-opacity', filesQ.isFetching && 'opacity-60')}>
                {data.files.map((f) => <FileRow key={f.id} file={f} />)}
              </ul>
            )}
            {(page > 0 || data.nextPageToken) && (
              <div className="flex items-center justify-between pt-1">
                <button disabled={page === 0 || filesQ.isFetching} onClick={() => setTokens((t) => t.slice(0, -1))} data-testid="button-files-prev" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs disabled:opacity-40"><ChevronLeft className="h-3 w-3" /> Previous</button>
                <span className="font-mono text-[11px] text-muted-foreground">page {page + 1}</span>
                <button disabled={!data.nextPageToken || filesQ.isFetching} onClick={() => data.nextPageToken && setTokens((t) => [...t, data.nextPageToken as string])} data-testid="button-files-next" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs disabled:opacity-40">Next <ChevronRight className="h-3 w-3" /></button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </aside>
  );
}

function FileRow({ file }: { file: CvFile }) {
  const { session, selectingFile, selectCv, selectError } = useCv();
  const isCurrent = session?.file.id === file.id;
  const isSelecting = selectingFile?.id === file.id;
  const failed = selectError?.file.id === file.id;
  const busy = !!selectingFile;
  return (
    <li className={cn('rounded-2xl border bg-card p-3 transition-colors', isCurrent && 'border-primary ring-2 ring-primary/15', isSelecting && 'sweep', failed && 'border-destructive/40')} data-testid={`row-cv-file-${file.id}`}>
      <div className="flex items-start gap-3">
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', file.supported ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}><FileText className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={file.name}>{file.name}</div>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{shortMime(file.mimeType)} · edited {timeAgo(file.modifiedTime) ?? 'unknown'}</div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        {file.supported ? (
          <button type="button" disabled={busy || isCurrent} onClick={() => selectCv(file)} data-testid={`button-select-cv-${file.id}`}
            className={cn('rounded-full px-3.5 py-1.5 text-xs font-medium transition-transform', isCurrent ? 'bg-primary/10 text-primary' : 'bg-primary text-primary-foreground hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0')}>
            {isCurrent ? 'Selected' : isSelecting ? 'Reading and analysing…' : failed ? 'Try again' : 'Use this CV'}
          </button>
        ) : (
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">Format not supported</span>
        )}
        <a href={file.webViewLink} target="_blank" rel="noreferrer" data-testid={`link-drive-${file.id}`} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Open in Drive <ExternalLink className="h-3 w-3" /></a>
      </div>
      {failed && <p className="mt-2 text-xs text-destructive" role="alert" data-testid={`status-select-error-${file.id}`}>{selectError?.message}</p>}
    </li>
  );
}

function shortMime(m: string) {
  if (m.includes('google-apps.document')) return 'Google Doc';
  if (m.includes('pdf')) return 'PDF';
  if (m.includes('wordprocessingml')) return 'DOCX';
  if (m.includes('markdown')) return 'Markdown';
  if (m.startsWith('text/')) return 'Text';
  if (m.startsWith('image/')) return 'Image';
  return m.split('/').pop() ?? m;
}

function useMinutesLeft(iso: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 20_000); return () => window.clearInterval(t); }, []);
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
}

function SelectedCv() {
  const { session, selectingFile, restoring, clearCv } = useCv();
  const mins = useMinutesLeft(session?.expiresAt);
  const [cat, setCat] = useState<CvSkillCategory | 'all'>('all');
  const grouped = useMemo(() => CATS.map((c) => ({ ...c, skills: (session?.profile.skills ?? []).filter((s) => s.category === c.k) })).filter((g) => g.skills.length), [session]);

  if (selectingFile || restoring) {
    return (
      <div className="rounded-3xl border bg-card p-6" role="status" aria-live="polite" data-testid="status-cv-analysing">
        <div className="font-mono text-[11px] uppercase tracking-wider text-primary">{restoring ? 'Restoring session' : 'Reading and analysing'}</div>
        <div className="mt-1 font-display text-2xl font-extrabold">{selectingFile?.name ?? 'Your selected CV'}</div>
        <div className="mt-5 space-y-3"><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /></div>
        <div className="mt-6 flex flex-wrap gap-2">{[64, 90, 52, 110, 70, 84].map((w, i) => <Skeleton key={i} className="h-7 rounded-full" style={{ width: w }} />)}</div>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-14 text-center" data-testid="text-no-cv">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-muted"><FileText className="h-5 w-5 text-muted-foreground" /></div>
        <h2 className="font-display text-2xl font-bold">No CV selected</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Choose a document on the left. Its skills appear here, then you can compare it against roles from Discover or Saved.</p>
      </div>
    );
  }
  const shown = cat === 'all' ? grouped : grouped.filter((g) => g.k === cat);
  return (
    <motion.section key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border bg-card" data-testid="card-selected-cv">
      <div className="flex flex-wrap items-start gap-4 border-b bg-accent/40 p-5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Selected CV</div>
          <h2 className="truncate font-display text-2xl font-extrabold" data-testid="text-cv-name">{session.file.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span>analysed {timeAgo(session.analyzedAt)}</span>
            <span className={cn('inline-flex items-center gap-1', mins !== null && mins <= 5 && 'text-primary')} data-testid="text-cv-expiry"><Clock className="h-3 w-3" /> clears in ~{mins} min</span>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={session.file.webViewLink} target="_blank" rel="noreferrer" data-testid="link-selected-drive" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-2 text-xs font-medium">Drive <ExternalLink className="h-3 w-3" /></a>
          <button onClick={clearCv} data-testid="button-clear-cv" className="rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-destructive">Clear</button>
        </div>
      </div>
      <div className="p-5">
        <p className="text-[15px] leading-relaxed" data-testid="text-cv-summary">{session.profile.summary}</p>
        <div className="mt-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Skill categories">
          <CatChip active={cat === 'all'} onClick={() => setCat('all')} testId="button-cat-all">All · {session.profile.skills.length}</CatChip>
          {grouped.map((g) => <CatChip key={g.k} active={cat === g.k} onClick={() => setCat(g.k)} testId={`button-cat-${g.k}`}><span className={cn('h-1.5 w-1.5 rounded-full', g.dot)} />{g.l} · {g.skills.length}</CatChip>)}
        </div>
        {grouped.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No skills could be evidenced from this document.</p> : (
          <div className="mt-4 space-y-5">
            {shown.map((g) => (
              <div key={g.k}>
                <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', g.dot)} />{g.l}</h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {g.skills.map((s, i) => (
                    <li key={i} className="rounded-xl border bg-background/60 p-3" data-testid={`card-skill-${g.k}-${i}`}>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="mt-1 line-clamp-3 text-xs italic text-muted-foreground" title={s.evidence}>"{s.evidence}"</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {session.profile.limitations.length > 0 && (
          <div className="mt-5 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground" data-testid="text-cv-limitations">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><Info className="h-3.5 w-3.5" /> Limits of this reading</div>
            <ul className="list-disc space-y-0.5 pl-4">{session.profile.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function CatChip({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} data-testid={testId}
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors', active ? 'border-secondary bg-secondary text-secondary-foreground' : 'bg-card hover:border-foreground/40')}>
      {children}
    </button>
  );
}

function RolesBoard() {
  const { roles, removeRole, retryRole, retryFailed, clearRoles, toggleRole } = useCv();
  const { result, isPending } = useScan();
  const { toast } = useToast();
  const focus = new URLSearchParams(useSearch()).get('role');
  const [open, setOpen] = useState<string | null>(focus);
  const scrolled = useRef(false);
  useEffect(() => {
    if (!focus || scrolled.current) return;
    scrolled.current = true;
    setOpen(focus);
    window.setTimeout(() => document.getElementById(`role-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }, [focus]);
  const failed = roles.filter((r) => r.status === 'error').length;
  const working = roles.filter((r) => r.status === 'queued' || r.status === 'pending').length;
  const jobs = result?.jobs ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Roles against this CV</h2>
          <p className="text-sm text-muted-foreground"><span className="font-mono text-foreground" data-testid="text-role-count">{roles.length}/{MAX_ROLES}</span> selected{working ? ` · ${working} in progress, two at a time` : ''}</p>
        </div>
        <div className="flex gap-2">
          {failed > 0 && <button onClick={retryFailed} data-testid="button-retry-failed" className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2 text-xs font-medium text-destructive-foreground"><RotateCw className="h-3 w-3" /> Retry {failed} failed</button>}
          {roles.length > 0 && <button onClick={clearRoles} data-testid="button-clear-roles" className="rounded-full border px-3.5 py-2 text-xs">Deselect all</button>}
        </div>
      </div>

      {roles.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground" data-testid="text-no-roles">
          Press <span className="font-medium text-foreground">Compare to CV</span> on any listing in <Link href="/discover" className="underline">Discover</Link> or <Link href="/saved" className="underline">Saved</Link>, or pick from the latest scan below.
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {roles.map((r) => {
              const isOpen = open === r.jobId && !!r.assessment;
              return (
                <motion.li key={r.jobId} id={`role-${r.jobId}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                  className={cn('rounded-2xl border bg-card', focus === r.jobId && 'ring-2 ring-primary/30')} data-testid={`row-role-${r.jobId}`}>
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <button type="button" disabled={!r.assessment} onClick={() => setOpen(isOpen ? null : r.jobId)} aria-expanded={isOpen} data-testid={`button-expand-role-${r.jobId}`}
                      className="min-w-0 flex-1 text-left disabled:cursor-default">
                      <div className="truncate font-display text-lg font-bold">{r.title}</div>
                      <div className="truncate text-sm text-muted-foreground">{r.company}</div>
                    </button>
                    <RoleStatusPill role={r} />
                    {r.status === 'error' && <button onClick={() => retryRole(r.jobId)} data-testid={`button-retry-role-${r.jobId}`} className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-3 py-1.5 text-xs text-destructive"><RotateCw className="h-3 w-3" /> Retry</button>}
                    {r.assessment && <button onClick={() => setOpen(isOpen ? null : r.jobId)} data-testid={`button-toggle-detail-${r.jobId}`} className="rounded-full border px-3 py-1.5 text-xs">{isOpen ? 'Hide' : 'Full assessment'}</button>}
                    <button onClick={() => removeRole(r.jobId)} aria-label={`Deselect ${r.title}`} data-testid={`button-remove-role-${r.jobId}`} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
                    {r.status === 'error' && <p className="basis-full text-xs text-destructive" role="alert">{r.error}</p>}
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen && r.assessment && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="border-t px-4 pb-4 pt-4"><AssessmentDetail a={r.assessment} /></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <div className="rounded-3xl border bg-card p-4">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="font-medium">From your latest scan</h3><span className="ml-auto font-mono text-[11px] text-muted-foreground">{isPending ? 'scanning' : `${jobs.length} roles`}</span></div>
        {isPending ? <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div> : jobs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No scan results yet. <Link href="/discover" className="underline">Run a search on Discover</Link>.</p>
        ) : (
          <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
            {jobs.map((j) => {
              const on = roles.some((r) => r.jobId === j.id);
              return (
                <li key={j.id}>
                  <button type="button" aria-pressed={on} data-testid={`button-pick-role-${j.id}`}
                    onClick={() => { const res = toggleRole(j); if (res === 'limit') toast({ title: `Up to ${MAX_ROLES} roles at a time`, description: 'Deselect one first.' }); }}
                    className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors', on ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted')}>
                    <Crosshair className={cn('h-4 w-4 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{j.title}</span><span className="block truncate text-xs opacity-70">{[j.company, j.location].filter(Boolean).join(' · ')}</span></span>
                    <span className="font-mono text-[10px] uppercase">{on ? 'selected' : 'compare'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Panel({ icon, title, body, children, tone, testId }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode; tone?: 'error'; testId: string }) {
  return (
    <div className={cn('rise mx-auto max-w-xl rounded-3xl border p-7', tone === 'error' ? 'border-destructive/30 bg-destructive/5' : 'bg-card')} role={tone === 'error' ? 'alert' : undefined} data-testid={testId}>
      <div className={cn('grid h-11 w-11 place-items-center rounded-2xl', tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-secondary-foreground')}>{icon}</div>
      <h1 className="mt-4 font-display text-2xl font-extrabold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
