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
    <main className="container pb-20">
      <section className="mb-7">
        <p className="chip mb-3">Matching</p>
        <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Match Inbox</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-muted)] md:text-base">
          Related beacons ranked by semantic similarity and intent fit.
        </p>
      </section>

      {matches.length === 0 ? (
        <div className="card p-6 text-sm text-[color:var(--ink-muted)]">No matches yet.</div>
      ) : (
        <div className="stagger space-y-3">
          {matches.map((match) => (
            <article key={match.id} className="card p-5">
              <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
                <span className="chip">{match.matchType}</span>
                <span>score {Number(match.score).toFixed(2)}</span>
              </div>
              <p className="mb-2 text-sm leading-relaxed text-[color:var(--ink)]">{match.reason}</p>
              <p className="text-xs text-[color:var(--ink-muted)]">status: {match.status}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
