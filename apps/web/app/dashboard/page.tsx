import { redirect } from 'next/navigation';

import { BeaconCard } from '@/components/beacon-card';
import { getCurrentUserId, UnauthorizedError } from '@/lib/auth';
import { listBeaconsForUser } from '@/lib/store';

export default async function DashboardPage() {
  let userId: string;

  try {
    userId = await getCurrentUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/login');
    }

    throw error;
  }

  const beacons = await listBeaconsForUser(userId);

  return (
    <main className="container pb-20">
      <section className="card mb-7 overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <p className="chip mb-3">My Beacons</p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-muted)] md:text-base">
              Review everything you have captured, refine drafts, and keep only the inquiries you want to be matched.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-3">
              <p className="text-2xl font-semibold">{beacons.length}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">Total</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-3">
              <p className="text-2xl font-semibold">{beacons.filter((beacon) => beacon.isMatchable).length}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">Open</p>
            </div>
          </div>
        </div>
      </section>

      {beacons.length === 0 ? (
        <div className="card p-8 text-sm leading-relaxed text-[color:var(--ink-muted)]">
          No Beacons yet. Create one through MCP capture or `POST /api/beacons`.
        </div>
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {beacons.map((beacon) => (
            <BeaconCard key={beacon.id} beacon={beacon} />
          ))}
        </div>
      )}
    </main>
  );
}
