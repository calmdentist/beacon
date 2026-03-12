import Link from 'next/link';

import type { Beacon } from '@beacon/core';

export function BeaconCard({ beacon }: { beacon: Beacon }) {
  const href = beacon.status === 'draft' ? `/beacons/${beacon.id}/review` : `/beacons/${beacon.id}`;

  return (
    <article className="card p-5">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500">
        <span>{beacon.status}</span>
        <span>{new Date(beacon.createdAt).toLocaleDateString()}</span>
      </div>
      <h3 className="mb-2 text-lg font-semibold">
        <Link href={href}>{beacon.title}</Link>
      </h3>
      <p className="mb-4 text-sm text-neutral-700">{beacon.summary}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {beacon.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#ece7d7] px-2 py-1 text-xs">
            {tag}
          </span>
        ))}
      </div>
      <div className="text-xs text-neutral-500">
        Matching: <strong>{beacon.isMatchable ? 'On' : 'Off'}</strong>
      </div>
    </article>
  );
}
