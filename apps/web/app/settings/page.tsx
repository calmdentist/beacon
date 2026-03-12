import { redirect } from 'next/navigation';

import { getCurrentUserId, UnauthorizedError } from '@/lib/auth';

export default async function SettingsPage() {
  try {
    await getCurrentUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/login');
    }

    throw error;
  }

  return (
    <main className="container pb-20">
      <p className="chip mb-3">Account</p>
      <h1 className="mb-4 text-4xl font-semibold leading-tight md:text-5xl">Settings</h1>
      <p className="card p-6 text-sm leading-relaxed text-[color:var(--ink-muted)] md:text-base">
        Auth, profile, and MCP token settings will live here.
      </p>
    </main>
  );
}
