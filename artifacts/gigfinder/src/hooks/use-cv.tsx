import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetCvAccess, useGetCvSession, useSelectCv, useAssessRole,
  getGetCvAccessQueryKey, getGetCvSessionQueryKey,
  type CvAccess, type CvFile, type CvSession, type Job, type RoleAssessment,
} from '@workspace/api-client-react';
import { describeCvError } from '@/lib/cv-errors';

export const MAX_ROLES = 10;
const MAX_CONCURRENT = 2;

export type RoleStatus = 'queued' | 'pending' | 'done' | 'error';
export interface RoleSel {
  jobId: string; title: string; company: string; url: string;
  status: RoleStatus; assessment?: RoleAssessment; error?: string;
  /** Unique per selection/attempt so late responses never land on a reselected role. */
  key: number;
}
export type ToggleResult = 'added' | 'removed' | 'no-cv' | 'limit';

interface Ctx {
  signedIn: boolean;
  access: CvAccess | undefined;
  accessLoading: boolean;
  accessError: string | null;
  refetchAccess: () => void;
  allowed: boolean;
  session: CvSession | null;
  restoring: boolean;
  selectingFile: CvFile | null;
  selectError: { file: CvFile; message: string } | null;
  notice: string | null;
  dismissNotice: () => void;
  selectCv: (file: CvFile) => void;
  clearCv: () => void;
  roles: RoleSel[];
  roleFor: (jobId: string) => RoleSel | undefined;
  toggleRole: (job: Pick<Job, 'id' | 'title' | 'company' | 'url'>) => ToggleResult;
  removeRole: (jobId: string) => void;
  retryRole: (jobId: string) => void;
  retryFailed: () => void;
  clearRoles: () => void;
}

let keySeq = 0;
const nextKey = () => ++keySeq;

const CvContext = createContext<Ctx | null>(null);
const storageKey = (uid: string) => `gigfinder:cv-session:${uid}`;
const store = {
  get(uid: string) { try { return sessionStorage.getItem(storageKey(uid)); } catch { return null; } },
  set(uid: string, id: string) { try { sessionStorage.setItem(storageKey(uid), id); } catch { /* storage unavailable */ } },
  del(uid: string) { try { sessionStorage.removeItem(storageKey(uid)); } catch { /* storage unavailable */ } },
};

function fromAssessments(list: RoleAssessment[]): RoleSel[] {
  return list.slice(0, MAX_ROLES).map((a) => ({ jobId: a.jobId, title: a.title, company: a.company, url: a.url, status: 'done', assessment: a, key: nextKey() }));
}

export function CvProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const signedIn = !!(isLoaded && isSignedIn && userId);
  const uid = signedIn ? (userId as string) : null;
  const qc = useQueryClient();

  const accessQ = useGetCvAccess({ query: { enabled: signedIn, queryKey: [...getGetCvAccessQueryKey(), uid], retry: false, staleTime: 60_000 } });
  const allowed = signedIn && !!accessQ.data?.allowed;

  const [session, setSession] = useState<CvSession | null>(null);
  const [roles, setRoles] = useState<RoleSel[]>([]);
  const [selectingFile, setSelectingFile] = useState<CvFile | null>(null);
  const [selectError, setSelectError] = useState<{ file: CvFile; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const epochRef = useRef(0);
  // Request keys actually in flight. Slots are released only when a request settles.
  const runningRef = useRef(new Set<number>());
  const [slotTick, setSlotTick] = useState(0);
  const [owner, setOwner] = useState<string | null>(null);
  const [stateUid, setStateUid] = useState<string | null>(null);
  const rolesRef = useRef(roles); rolesRef.current = roles;
  const sessionRef = useRef(session); sessionRef.current = session;
  const uidRef = useRef(uid); uidRef.current = uid;

  const selectM = useSelectCv();
  const assessM = useAssessRole();
  const selectRef = useRef(selectM.mutateAsync); selectRef.current = selectM.mutateAsync;
  const assessRef = useRef(assessM.mutateAsync); assessRef.current = assessM.mutateAsync;

  const resetPrivate = useCallback(() => {
    epochRef.current += 1;
    setSession(null); setOwner(null); setRoles([]); setSelectingFile(null); setSelectError(null); setRestoreId(null);
  }, []);

  const expire = useCallback((message: string) => {
    const old = sessionRef.current;
    resetPrivate();
    if (old) qc.removeQueries({ queryKey: getGetCvSessionQueryKey(old.id) });
    if (uidRef.current) store.del(uidRef.current);
    setNotice(message);
  }, [qc, resetPrivate]);

  // Auth identity change: drop every piece of private state.
  const prevUid = useRef<string | null | undefined>(undefined);
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    if (prevUid.current !== undefined && prevUid.current !== uid) {
      resetPrivate(); setNotice(null); restoredFor.current = null;
    }
    prevUid.current = uid;
    setStateUid(uid);
  }, [isLoaded, uid, resetPrivate]);

  // Restore a session id kept in sessionStorage for this user.
  useEffect(() => {
    if (!uid || !allowed || restoredFor.current === uid) return;
    restoredFor.current = uid;
    if (sessionRef.current) return;
    const id = store.get(uid);
    if (id) setRestoreId(id);
  }, [uid, allowed]);

  const restoreQ = useGetCvSession(restoreId ?? '', {
    query: { enabled: !!restoreId && allowed, queryKey: getGetCvSessionQueryKey(restoreId ?? ''), retry: false, staleTime: 0, gcTime: 0 },
  });
  const restoreEpoch = useRef(epochRef.current);
  useEffect(() => { if (restoreId) restoreEpoch.current = epochRef.current; }, [restoreId]);
  useEffect(() => {
    if (!restoreId) return;
    if (restoreQ.data && restoreQ.data.id === restoreId) {
      if (restoreEpoch.current === epochRef.current) {
        setSession(restoreQ.data); setOwner(uidRef.current); setRoles(fromAssessments(restoreQ.data.assessments));
      }
      setRestoreId(null);
    } else if (restoreQ.error) {
      const info = describeCvError(restoreQ.error, 'session');
      if (uidRef.current) store.del(uidRef.current);
      setNotice(info.expired ? 'Your previous CV session is gone: sessions last 30 minutes and a server restart clears them. Select your CV again.' : info.message);
      setRestoreId(null);
    }
  }, [restoreId, restoreQ.data, restoreQ.error]);

  // Fixed 30-minute TTL on the server: clear locally when it lapses.
  useEffect(() => {
    if (!session) return;
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    const t = window.setTimeout(() => expire('Your CV session reached its 30-minute limit, so the CV and its assessments were cleared. Select your CV again to continue.'), Math.max(0, ms));
    return () => window.clearTimeout(t);
  }, [session, expire]);

  const selectCv = useCallback((file: CvFile) => {
    const old = sessionRef.current;
    resetPrivate();
    if (old) qc.removeQueries({ queryKey: getGetCvSessionQueryKey(old.id) });
    if (uidRef.current) store.del(uidRef.current);
    setNotice(null);
    setSelectingFile(file);
    const ep = epochRef.current;
    selectRef.current({ data: { fileId: file.id } }).then((s) => {
      if (ep !== epochRef.current) return;
      setSession(s); setOwner(uidRef.current); setRoles(fromAssessments(s.assessments)); setSelectingFile(null);
      if (uidRef.current) store.set(uidRef.current, s.id);
    }).catch((e) => {
      if (ep !== epochRef.current) return;
      setSelectingFile(null);
      setSelectError({ file, message: describeCvError(e, 'select').message });
    });
  }, [qc, resetPrivate]);

  const clearCv = useCallback(() => {
    const old = sessionRef.current;
    resetPrivate();
    if (old) qc.removeQueries({ queryKey: getGetCvSessionQueryKey(old.id) });
    if (uidRef.current) store.del(uidRef.current);
    setNotice(null);
  }, [qc, resetPrivate]);

  // Queue runner: at most two assessments in flight, counted across CV changes.
  useEffect(() => {
    if (!session) return;
    const running = runningRef.current;
    const free = MAX_CONCURRENT - running.size;
    if (free <= 0) return;
    const next = roles.filter((r) => r.status === 'queued').slice(0, free);
    if (!next.length) return;
    const ep = epochRef.current;
    const sid = session.id;
    next.forEach((r) => {
      const key = r.key;
      running.add(key);
      setRoles((rs) => rs.map((x) => (x.key === key ? { ...x, status: 'pending', error: undefined } : x)));
      assessRef.current({ data: { cvSessionId: sid, jobId: r.jobId } }).then((a) => {
        if (ep !== epochRef.current || a.cvSessionId !== sid) return;
        setRoles((rs) => rs.map((x) => (x.key === key ? { ...x, status: 'done', assessment: a, title: a.title || x.title, company: a.company || x.company } : x)));
      }).catch((e) => {
        if (ep !== epochRef.current) return;
        const info = describeCvError(e, 'assess');
        if (info.expired) { expire(info.message); return; }
        setRoles((rs) => rs.map((x) => (x.key === key ? { ...x, status: 'error', error: info.message } : x)));
      }).finally(() => { running.delete(key); setSlotTick((t) => t + 1); });
    });
  }, [roles, session, expire, slotTick]);

  const toggleRole = useCallback((job: Pick<Job, 'id' | 'title' | 'company' | 'url'>): ToggleResult => {
    const cur = rolesRef.current;
    if (cur.some((r) => r.jobId === job.id)) {
      setRoles((rs) => rs.filter((r) => r.jobId !== job.id));
      return 'removed';
    }
    if (!sessionRef.current) return 'no-cv';
    if (cur.length >= MAX_ROLES) return 'limit';
    setRoles((rs) => (rs.some((r) => r.jobId === job.id) ? rs : [...rs, { jobId: job.id, title: job.title, company: job.company, url: job.url, status: 'queued', key: nextKey() }]));
    return 'added';
  }, []);

  const removeRole = useCallback((jobId: string) => { setRoles((rs) => rs.filter((r) => r.jobId !== jobId)); }, []);
  const retryRole = useCallback((jobId: string) => {
    setRoles((rs) => rs.map((r) => (r.jobId === jobId && r.status === 'error' ? { ...r, status: 'queued', error: undefined, key: nextKey() } : r)));
  }, []);
  const retryFailed = useCallback(() => {
    setRoles((rs) => rs.map((r) => (r.status === 'error' ? { ...r, status: 'queued', error: undefined, key: nextKey() } : r)));
  }, []);
  const clearRoles = useCallback(() => { setRoles([]); }, []);
  // Never expose private state of another (or no longer permitted) identity, even for one render.
  const mine = allowed && !!uid && stateUid === uid;
  const visible = mine && owner === uid;
  const vSession = visible ? session : null;
  const vRoles = useMemo(() => (visible ? roles : []), [visible, roles]);
  const roleFor = useCallback((jobId: string) => vRoles.find((r) => r.jobId === jobId), [vRoles]);

  const accessError = accessQ.error ? describeCvError(accessQ.error, 'access').message : null;
  const refetchAccess = useCallback(() => { void accessQ.refetch(); }, [accessQ]);

  const value = useMemo<Ctx>(() => ({
    signedIn, access: signedIn ? accessQ.data : undefined, accessLoading: signedIn && accessQ.isLoading, accessError, refetchAccess, allowed,
    session: vSession, restoring: mine && !!restoreId, selectingFile: mine ? selectingFile : null, selectError: mine ? selectError : null, notice: mine ? notice : null, dismissNotice: () => setNotice(null),
    selectCv, clearCv, roles: vRoles, roleFor, toggleRole, removeRole, retryRole, retryFailed, clearRoles,
  }), [signedIn, accessQ.data, accessQ.isLoading, accessError, refetchAccess, allowed, mine, vSession, restoreId, selectingFile, selectError, notice,
    selectCv, clearCv, vRoles, roleFor, toggleRole, removeRole, retryRole, retryFailed, clearRoles]);

  return <CvContext.Provider value={value}>{children}</CvContext.Provider>;
}

export function useCv() {
  const ctx = useContext(CvContext);
  if (!ctx) throw new Error('useCv must be used inside CvProvider');
  return ctx;
}
