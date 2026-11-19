import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useScanSources, type ScanResult, type SearchFilters, type SearchFiltersOfferType } from '@workspace/api-client-react';

export interface Draft {
  title: string;
  city: string;
  industry: string;
  offerType: SearchFiltersOfferType;
}

export const emptyDraft: Draft = { title: '', city: '', industry: '', offerType: 'all' };

export function normalize(f: SearchFilters | Draft): Draft {
  return {
    title: (f.title ?? '').trim(),
    city: (f.city ?? '').trim(),
    industry: (f.industry ?? '').trim(),
    offerType: (f.offerType ?? 'all') as SearchFiltersOfferType,
  };
}

export function sameFilters(a: SearchFilters | Draft, b: SearchFilters | Draft) {
  const x = normalize(a), y = normalize(b);
  return x.title.toLowerCase() === y.title.toLowerCase() && x.city.toLowerCase() === y.city.toLowerCase() && x.industry.toLowerCase() === y.industry.toLowerCase() && x.offerType === y.offerType;
}

interface Ctx {
  draft: Draft;
  setDraft: (d: Draft) => void;
  result: ScanResult | null;
  pendingFilters: Draft | null;
  isPending: boolean;
  error: string | null;
  scan: (d?: Draft) => void;
}

const ScanContext = createContext<Ctx | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pendingFilters, setPending] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useScanSources();
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const scan = useCallback((d?: Draft) => {
    const f = normalize(d ?? draftRef.current);
    setPending(f);
    setError(null);
    mutateRef.current({ data: f }, {
      onSuccess: (r) => { setResult(r); setPending(null); },
      onError: (e) => {
        setError(e instanceof Error ? e.message : 'The scan request failed.');
      },
    });
  }, []);

  const didAuto = useRef(false);
  useEffect(() => {
    if (didAuto.current) return;
    didAuto.current = true;
    scan(emptyDraft);
  }, [scan]);

  const value = useMemo(() => ({ draft, setDraft, result, pendingFilters, isPending: mutation.isPending, error, scan }),
    [draft, result, pendingFilters, mutation.isPending, error, scan]);
  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScan must be used inside ScanProvider');
  return ctx;
}
