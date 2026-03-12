import './globals.css';

import type { Metadata } from 'next';
import Link from 'next/link';

import { auth, signOut } from '@/auth';

export const metadata: Metadata = {
  title: 'Beacon',
  description: 'Turn your best LLM rabbit holes into discoverable inquiry cards.'
};

async function signOutAction() {
  'use server';
  await signOut({ redirectTo: '/login' });
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAuthenticated = Boolean((session?.user as { id?: string } | undefined)?.id);

  return (
    <html lang="en">
      <body>
        <header className="container py-6">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-xl font-bold tracking-tight">
              Beacon
            </Link>
            <div className="flex gap-4 text-sm">
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/matches">Matches</Link>
                  <Link href="/intros">Intros</Link>
                  <Link href="/admin">Admin</Link>
                  <form action={signOutAction}>
                    <button type="submit" className="text-sm">
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login">Login</Link>
              )}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
