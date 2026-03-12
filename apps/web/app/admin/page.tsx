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
    <main className="container pb-16">
      <h1 className="mb-2 text-3xl font-semibold">Admin</h1>
      <p className="card p-6 text-neutral-700">
        Planned tools: inspect Beacons, regenerate matches, handle intro requests, and review MCP capture failures.
      </p>
    </main>
  );
}
