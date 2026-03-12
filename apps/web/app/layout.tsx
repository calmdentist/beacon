import './globals.css';
import '@neondatabase/auth/ui/css';

import type { Metadata } from 'next';
import { Instrument_Sans } from 'next/font/google';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'Beacon',
  description: 'Beacon is the social layer for live inquiry in the LLM era.'
};

export const dynamic = 'force-dynamic';

const uiFont = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-ui',
  weight: ['400', '500', '600', '700']
});

async function signOutAction() {
  'use server';
  await auth.signOut();
  redirect('/login');
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = await auth.getSession();
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <html lang="en">
      <body className={uiFont.variable}>
        <AuthProvider>
          <header className="nav-wrap">
            <nav className="container app-nav">
              <Link href="/" className="brand-mark">
                <span aria-hidden="true" className="brand-icon">
                  💡
                </span>
                Beacon
              </Link>
              <div className="nav-links">
                {isAuthenticated ? (
                  <>
                    <Link href="/dashboard">Dashboard</Link>
                    <Link href="/matches">Matches</Link>
                    <Link href="/intros">Intros</Link>
                    <Link href="/admin">Admin</Link>
                    <form action={signOutAction}>
                      <button type="submit" className="button-ghost text-sm">
                        Logout
                      </button>
                    </form>
                  </>
                ) : (
                  <Link href="/login" className="button-primary nav-login text-sm">
                    Login
                  </Link>
                )}
              </div>
            </nav>
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
