import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { Route, Switch, useLocation, Redirect, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Discover from '@/pages/discover';
import Saved from '@/pages/saved';
import Sources from '@/pages/sources';
import CvPage from '@/pages/cv';
import { Layout } from '@/components/layout';
import { SavedProvider } from '@/hooks/use-saved';
import { ScanProvider } from '@/hooks/use-scan';
import { CvProvider } from '@/hooks/use-cv';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } } });

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const INK = 'hsl(228 38% 14%)';
const clerkAppearance = {
  theme: 'simple' as const,
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(11 82% 52%)',
    colorForeground: INK,
    colorMutedForeground: 'hsl(228 12% 38%)',
    colorDanger: 'hsl(352 70% 44%)',
    colorBackground: 'hsl(40 40% 98%)',
    colorInput: 'hsl(38 33% 95%)',
    colorInputForeground: INK,
    colorNeutral: INK,
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
    cardBox: { background: 'hsl(40 40% 98%)', borderRadius: '1.5rem', width: '440px', maxWidth: '100%', overflow: 'hidden', border: '1px solid hsl(34 18% 84%)', boxShadow: '0 24px 60px -30px hsl(228 38% 14% / 0.45)' },
    card: { boxShadow: 'none', border: 0, background: 'transparent', borderRadius: 0 },
    footer: { boxShadow: 'none', border: 0, background: 'transparent', borderRadius: 0 },
    headerTitle: { fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.02em', color: INK },
    headerSubtitle: { color: 'hsl(228 12% 38%)' },
    socialButtonsBlockButtonText: { color: INK, fontWeight: 500 },
    formFieldLabel: { color: INK, fontWeight: 500 },
    footerActionLink: { color: 'hsl(11 82% 46%)', fontWeight: 600 },
    footerActionText: { color: 'hsl(228 12% 38%)' },
    dividerText: { color: 'hsl(228 12% 38%)' },
    identityPreviewEditButton: { color: 'hsl(11 82% 46%)' },
    formFieldSuccessText: { color: 'hsl(160 40% 28%)' },
    alertText: { color: INK },
    logoBox: { height: '48px', justifyContent: 'flex-start' },
    logoImage: { height: '44px', width: '44px' },
    socialButtonsBlockButton: { border: '1px solid hsl(34 18% 80%)', background: 'hsl(40 40% 98%)', borderRadius: '999px' },
    formButtonPrimary: { background: 'hsl(11 82% 52%)', color: 'hsl(40 40% 98%)', borderRadius: '999px', fontWeight: 600, boxShadow: 'none' },
    formFieldInput: { background: 'hsl(38 33% 95%)', border: '1px solid hsl(34 16% 78%)', color: INK, borderRadius: '0.75rem' },
    footerAction: { padding: '0.5rem 0' },
    dividerLine: { background: 'hsl(34 18% 84%)' },
    alert: { background: 'hsl(352 70% 44% / 0.08)', border: '1px solid hsl(352 70% 44% / 0.3)' },
    otpCodeFieldInput: { border: '1px solid hsl(34 16% 70%)', color: INK },
    formFieldRow: { marginBottom: '0.25rem' },
    main: { gap: '1.25rem' },
  },
};

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-10 text-secondary-foreground lg:flex">
        <span className="font-display text-xl font-extrabold">GigFinder</span>
        <div>
          <p className="font-display text-5xl font-extrabold leading-[1.02]">Find the roles.<br />Then check which<br /><span className="text-primary">ones fit.</span></p>
          <p className="mt-4 max-w-sm opacity-70">Signing in unlocks the private CV workspace. Everything else in GigFinder stays open without an account.</p>
        </div>
        <span className="font-mono text-[11px] opacity-50">Western Europe · public feeds · your Drive, your eyes only</span>
        <span className="absolute -right-24 top-1/3 h-72 w-72 rounded-full border-[28px] border-primary/25" aria-hidden />
      </div>
      <div className="flex items-center justify-center px-4 py-10">{children}</div>
    </div>
  );
}

function SignInPage() {
  return <AuthShell><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthShell>;
}

function SignUpPage() {
  return <AuthShell><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthShell>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/discover" /></Show>
      <Show when="signed-out"><Discover /></Show>
    </>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route>
        <Layout>
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/discover" component={Discover} />
              <Route path="/cv" component={CvPage} />
              <Route path="/saved" component={Saved} />
              <Route path="/sources" component={Sources} />
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
        </Layout>
      </Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back to GigFinder', subtitle: 'Sign in to open your private CV workspace' } },
        signUp: { start: { title: 'Create your GigFinder account', subtitle: 'Compare your CV against the roles you shortlist' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <SavedProvider>
            <ScanProvider>
              <CvProvider>
                <AppRoutes />
              </CvProvider>
            </ScanProvider>
          </SavedProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
