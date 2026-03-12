import Link from 'next/link';

import type { Beacon } from '@beacon/core';

export function BeaconCard({ beacon }: { beacon: Beacon }) {
  const href = beacon.status === 'draft' ? `/beacons/${beacon.id}/review` : `/beacons/${beacon.id}`;

  return (
    <article className="card group p-5 transition-transform duration-300 hover:-translate-y-1">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
        <span className="chip">{beacon.status}</span>
        <span>{new Date(beacon.createdAt).toLocaleDateString()}</span>
      </div>

      <h3 className="mb-2 text-xl font-semibold leading-tight">
        <Link href={href} className="group-hover:text-[color:var(--brand)]">
          {beacon.title}
        </Link>
      </h3>
      <p className="mb-5 text-sm leading-relaxed text-[color:var(--ink-muted)]">{beacon.summary}</p>

      <div className="mb-5 flex flex-wrap gap-2">
        {beacon.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[rgba(31,122,112,0.22)] bg-[rgba(31,122,112,0.11)] px-2.5 py-1 text-xs font-semibold text-[color:var(--teal)]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="text-xs text-[color:var(--ink-muted)]">
        Matching: <strong className={beacon.isMatchable ? 'text-[color:var(--teal)]' : 'text-[color:var(--brand)]'}>{beacon.isMatchable ? 'On' : 'Off'}</strong>
      </div>
    </article>
  );
}
