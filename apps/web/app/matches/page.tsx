import { redirect } from 'next/navigation';

import { getCurrentUserId, UnauthorizedError } from '@/lib/auth';
import { listMatchesForUser } from '@/lib/store';

export default async function MatchesPage() {
  let userId: string;

  try {
    userId = await getCurrentUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/login');
    }

    throw error;
  }

  const matches = await listMatchesForUser(userId);

  return (
    <main className="container pb-16">
      <h1 className="mb-2 text-3xl font-semibold">Match inbox</h1>
      <p className="mb-8 text-neutral-600">Suggested related Beacons and intro opportunities.</p>

      {matches.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-700">No matches yet.</div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <article key={match.id} className="card p-5">
              <div className="mb-2 flex items-center justify-between text-sm text-neutral-500">
                <span>{match.matchType}</span>
                <span>score: {Number(match.score).toFixed(2)}</span>
              </div>
              <p className="mb-2 text-sm text-neutral-700">{match.reason}</p>
              <p className="text-xs text-neutral-500">status: {match.status}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
