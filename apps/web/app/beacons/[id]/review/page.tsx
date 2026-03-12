import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

import { ReviewDraftForm } from '@/components/review-draft-form';
import { getCurrentUserId, UnauthorizedError } from '@/lib/auth';
import { getBeaconForUser } from '@/lib/store';

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

const idSchema = z.string().uuid();

export default async function BeaconDraftReviewPage({ params }: ReviewPageProps) {
  const { id: rawId } = await params;
  const idResult = idSchema.safeParse(rawId);

  if (!idResult.success) {
    notFound();
  }

  let userId: string;

  try {
    userId = await getCurrentUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/login');
    }

    throw error;
  }

  const beacon = await getBeaconForUser(userId, idResult.data);

  if (!beacon) {
    notFound();
  }

  if (beacon.status !== 'draft') {
    redirect(`/beacons/${beacon.id}`);
  }

  return (
    <main className="container pb-20">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="chip mb-2">MCP Draft Review</p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Review Beacon Draft</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-muted)] md:text-base">
            Edit the generated draft, choose matching settings, and publish when ready.
          </p>
        </div>
        <Link href="/dashboard" className="button-ghost text-sm">
          Back to Dashboard
        </Link>
      </div>

      <ReviewDraftForm draft={beacon} />
    </main>
  );
}
