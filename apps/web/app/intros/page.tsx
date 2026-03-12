import { redirect } from 'next/navigation';

import { getCurrentUserId, UnauthorizedError } from '@/lib/auth';
import { listIntrosForUser } from '@/lib/store';

export default async function IntrosPage() {
  let userId: string;

  try {
    userId = await getCurrentUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/login');
    }

    throw error;
  }

  const intros = await listIntrosForUser(userId);

  return (
    <main className="container pb-20">
      <section className="mb-7">
        <p className="chip mb-3">Intros</p>
        <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Intro Requests</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-muted)] md:text-base">
          Lightweight handoffs between people exploring adjacent threads.
        </p>
      </section>

      {intros.length === 0 ? (
        <div className="card p-6 text-sm text-[color:var(--ink-muted)]">No intro requests yet.</div>
      ) : (
        <div className="stagger space-y-3">
          {intros.map((intro) => (
            <article key={intro.id} className="card p-5 text-sm">
              <p>
                from <strong>{intro.fromUserId}</strong> to <strong>{intro.toUserId}</strong>
              </p>
              <p className="text-[color:var(--ink-muted)]">status: {intro.status}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
