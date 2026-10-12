'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

const NAV_LINKS = [
  { href: '/missions', label: 'MISSIONS' },
  { href: '/community', label: 'COMMUNITY' },
];

const DASHBOARD_HREF: Record<string, string> = {
  OPERATOR: '/operator',
  PARTICIPANT: '/participant',
  CLIENT: '/client',
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    clearAuth();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm border-b border-line">
      <nav className="max-w-6xl mx-auto px-5 sm:px-10 py-5 flex items-center justify-between">
        <button
          type="button"
          className="sm:hidden flex flex-col gap-1.5 w-6"
          aria-label="메뉴 열기"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="h-px w-full bg-ink" />
          <span className="h-px w-full bg-ink" />
          <span className="h-px w-full bg-ink" />
        </button>

        <ul className="hidden sm:flex items-center gap-7 flex-1">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`text-[11px] tracking-widest2 hover:text-muted transition-colors ${
                  pathname?.startsWith(l.href) ? 'text-ink border-b border-ink pb-0.5' : 'text-ink/80'
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link href="/" className="font-serif italic text-2xl sm:text-3xl tracking-wide px-4 whitespace-nowrap">
          맘브릿지
        </Link>

        <div className="flex-1 flex items-center justify-end gap-5 text-[11px] tracking-widest2">
          {user ? (
            <>
              <Link href={DASHBOARD_HREF[user.role] ?? '/'} className="hover:text-muted transition-colors">
                MY PAGE
              </Link>
              <button type="button" onClick={handleLogout} className="hover:text-muted transition-colors">
                LOGOUT
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-muted transition-colors">
                LOGIN
              </Link>
              <Link href="/register" className="hover:text-muted transition-colors">
                JOIN
              </Link>
            </>
          )}
        </div>
      </nav>

      {menuOpen && (
        <div className="sm:hidden border-t border-line px-5 py-4 flex flex-col gap-3 bg-cream">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-xs tracking-widest2 py-2" onClick={() => setMenuOpen(false)}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
