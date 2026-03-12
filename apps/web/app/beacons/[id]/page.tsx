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
    <main className="container pb-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{beacon.title}</h1>
        <Link href="/dashboard" className="text-sm text-neutral-600 underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>

      <section className="card mb-6 p-6">
        <p className="mb-4 text-sm text-neutral-600">Summary</p>
        <p className="mb-6 text-lg">{beacon.summary}</p>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm uppercase tracking-wide text-neutral-500">What I&apos;m exploring</h2>
            <p>{beacon.exploring}</p>
          </div>
          <div>
            <h2 className="mb-2 text-sm uppercase tracking-wide text-neutral-500">What I want help with</h2>
            <p>{beacon.helpWanted}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {beacon.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[#ece7d7] px-2 py-1 text-xs">
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-xl font-semibold">Related Beacons</h2>
        {related.length === 0 ? (
          <p className="text-neutral-700">No related matches yet.</p>
        ) : (
          <ul className="space-y-3">
            {related.map((item) => (
              <li key={item.beaconId} className="rounded-xl border border-[#ddd5bd] p-4">
                <div className="mb-2 flex items-center justify-between text-sm text-neutral-500">
                  <span>{item.matchType}</span>
                  <span>score: {item.score.toFixed(2)}</span>
                </div>
                <p className="text-sm">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
