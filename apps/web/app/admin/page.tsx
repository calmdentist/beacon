import { redirect } from 'next/navigation';

import { getCurrentUserId, UnauthorizedError } from '@/lib/auth';

export default async function AdminPage() {
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
      <p className="chip mb-3">Internal</p>
      <h1 className="mb-4 text-4xl font-semibold leading-tight md:text-5xl">Admin</h1>
      <p className="card p-6 text-sm leading-relaxed text-[color:var(--ink-muted)] md:text-base">
        Planned tools: inspect Beacons, regenerate matches, handle intro requests, and review MCP capture failures.
      </p>
    </main>
  );
}
