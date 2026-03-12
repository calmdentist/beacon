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
    <main className="container pb-16">
      <h1 className="mb-2 text-3xl font-semibold">Settings</h1>
      <p className="card p-6 text-neutral-700">Auth, profile, and MCP token settings will live here.</p>
    </main>
  );
}
