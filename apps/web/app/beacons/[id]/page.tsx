import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

import { getCurrentUserId, UnauthorizedError } from '@/lib/auth';
import { getBeaconForUser, getRelatedForBeacon } from '@/lib/store';

interface BeaconDetailPageProps {
  params: Promise<{ id: string }>;
}

const idSchema = z.string().uuid();

export default async function BeaconDetailPage({ params }: BeaconDetailPageProps) {
  const { id: rawId } = await params;
  const idResult = idSchema.safeParse(rawId);

  if (!idResult.success) {
    notFound();
  }

  const id = idResult.data;
  let userId: string;

  try {
    userId = await getCurrentUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/login');
    }

    throw error;
  }

  const beacon = await getBeaconForUser(userId, id);

  if (!beacon) {
    notFound();
  }

  if (beacon.status === 'draft') {
    redirect(`/beacons/${id}/review`);
  }

  const related = await getRelatedForBeacon(userId, id);

  return (
    <main className="container pb-20">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="chip mb-2">Beacon</p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">{beacon.title}</h1>
        </div>
        <Link href="/dashboard" className="button-ghost text-sm">
          Back to Dashboard
        </Link>
      </div>

      <section className="card mb-6 p-6 md:p-8">
        <p className="mb-4 text-xs uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">Summary</p>
        <p className="mb-6 text-lg leading-relaxed md:text-xl">{beacon.summary}</p>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-xs uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">What I&apos;m exploring</h2>
            <p className="leading-relaxed">{beacon.exploring}</p>
          </div>
          <div>
            <h2 className="mb-2 text-xs uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">What I want help with</h2>
            <p className="leading-relaxed">{beacon.helpWanted}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {beacon.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[rgba(31,122,112,0.22)] bg-[rgba(31,122,112,0.11)] px-2.5 py-1 text-xs font-semibold text-[color:var(--teal)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-xl font-semibold">Related Beacons</h2>
        {related.length === 0 ? (
          <p className="text-[color:var(--ink-muted)]">No related matches yet.</p>
        ) : (
          <ul className="stagger space-y-3">
            {related.map((item) => (
              <li key={item.beaconId} className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
                  <span className="chip">{item.matchType}</span>
                  <span>score {item.score.toFixed(2)}</span>
                </div>
                <p className="text-sm leading-relaxed">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
