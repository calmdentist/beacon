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
    <main className="container pb-16">
      <section className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-neutral-600">All saved Beacons and matching status.</p>
        </div>
      </section>

      {beacons.length === 0 ? (
        <div className="card p-8 text-sm text-neutral-700">No Beacons yet. Create one through `POST /api/beacons`.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {beacons.map((beacon) => (
            <BeaconCard key={beacon.id} beacon={beacon} />
          ))}
        </div>
      )}
    </main>
  );
}
