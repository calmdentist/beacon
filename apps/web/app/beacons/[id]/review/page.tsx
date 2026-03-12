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
    <main className="container pb-16">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500">MCP Draft Review</p>
          <h1 className="text-3xl font-semibold">Review Beacon Draft</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Edit the generated draft, choose matching settings, and publish when ready.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-neutral-600 underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>

      <ReviewDraftForm draft={beacon} />
    </main>
  );
}
