import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Compass, Heart, LayoutGrid } from 'lucide-react';
import { useSaved } from '@/hooks/use-saved';
import { useScan } from '@/hooks/use-scan';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Discover', icon: Compass },
  { href: '/saved', label: 'Saved', icon: Heart },
  { href: '/sources', label: 'Sources', icon: LayoutGrid },
];

export function Layout({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { jobs, searches } = useSaved();
  const { isPending } = useScan();
  const pendingFollow = jobs.filter((j) => !j.followedUp).length + searches.filter((s) => !s.followedUp).length;

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-secondary text-secondary-foreground">
              <span className="font-display text-lg font-extrabold leading-none">g</span>
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
            </span>
            <span className="hidden font-display text-xl font-extrabold sm:inline">GigFinder</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 rounded-full border bg-card p-1 md:flex">
            {NAV.map((n) => {
              const active = n.href === '/' ? loc === '/' : loc.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} data-testid={`link-nav-${n.label.toLowerCase()}`}
                  className={cn('relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors', active ? 'text-secondary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-secondary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <n.icon className="relative h-4 w-4" />
                  <span className="relative">{n.label}</span>
                  {n.href === '/saved' && pendingFollow > 0 && (
                    <span className="relative rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground" data-testid="text-followup-count">{pendingFollow}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground md:ml-3">
            <span className={cn('h-2 w-2 rounded-full', isPending ? 'animate-pulse bg-primary' : 'bg-[#61A9BD]')} />
            {isPending ? 'scanning' : 'ready'}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-16">{children}</main>
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 rounded-2xl border bg-secondary p-1.5 text-secondary-foreground shadow-lg md:hidden">
        {NAV.map((n) => {
          const active = n.href === '/' ? loc === '/' : loc.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} data-testid={`link-mobile-${n.label.toLowerCase()}`}
              className={cn('relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium', active ? 'text-secondary' : 'opacity-70')}>
              {active && <motion.span layoutId="mnav-pill" className="absolute inset-0 rounded-xl bg-background" />}
              <n.icon className="relative h-4 w-4" />
              <span className="relative">{n.label}{n.href === '/saved' && pendingFollow > 0 ? ` ${pendingFollow}` : ''}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
