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
    <main className="container pb-16">
      <h1 className="mb-2 text-3xl font-semibold">Intro requests</h1>
      <p className="mb-8 text-neutral-600">Mutual request handling and lightweight handoffs.</p>

      {intros.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-700">No intro requests yet.</div>
      ) : (
        <div className="space-y-3">
          {intros.map((intro) => (
            <article key={intro.id} className="card p-5 text-sm">
              <p>
                from <strong>{intro.fromUserId}</strong> to <strong>{intro.toUserId}</strong>
              </p>
              <p className="text-neutral-600">status: {intro.status}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
