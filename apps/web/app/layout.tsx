import './globals.css';
import '@neondatabase/auth/ui/css';

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'Beacon',
  description: 'Turn your best LLM rabbit holes into discoverable inquiry cards.'
};

export const dynamic = 'force-dynamic';

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
      <body>
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}
