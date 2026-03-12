'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { Beacon } from '@beacon/core';

interface ReviewDraftFormProps {
  draft: Beacon;
}

type DraftAction = 'save_draft' | 'save_beacon' | 'discard';

export function ReviewDraftForm({ draft }: ReviewDraftFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(draft.title);
  const [summary, setSummary] = useState(draft.summary);
  const [exploring, setExploring] = useState(draft.exploring);
  const [helpWanted, setHelpWanted] = useState(draft.helpWanted);
  const [tagsInput, setTagsInput] = useState(draft.tags.join(', '));
  const [openToMatching, setOpenToMatching] = useState(draft.isMatchable);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const normalizedTags = useMemo(() => {
    return Array.from(
      new Set(
        tagsInput
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    );
  }, [tagsInput]);

  function runAction(action: DraftAction) {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const payload =
          action === 'discard'
            ? {
                status: 'archived',
                isMatchable: false
              }
            : {
                title,
                summary,
                exploring,
                helpWanted,
                tags: normalizedTags,
                sourceType: 'mcp',
                status: action === 'save_beacon' ? 'saved' : 'draft',
                isMatchable: action === 'save_beacon' ? openToMatching : false
              };

        const response = await fetch(`/api/beacons/${draft.id}`, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Failed to update draft' }));
          throw new Error(typeof body.error === 'string' ? body.error : 'Failed to update draft');
        }

        if (action === 'discard') {
          router.push('/dashboard');
          router.refresh();
          return;
        }

        if (action === 'save_beacon') {
          router.push(`/beacons/${draft.id}`);
          router.refresh();
          return;
        }

        setNotice('Draft saved. You can come back and publish when ready.');
        router.refresh();
      } catch (actionError) {
        const message = actionError instanceof Error ? actionError.message : 'Unexpected error';
        setError(message);
      }
    });
  }

  return (
    <section className="card space-y-5 p-6">
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-neutral-700">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          maxLength={160}
        />
      </div>

      <div>
        <label htmlFor="summary" className="mb-1 block text-sm font-medium text-neutral-700">
          Summary
        </label>
        <textarea
          id="summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          className="min-h-20 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          maxLength={1200}
        />
      </div>

      <div>
        <label htmlFor="exploring" className="mb-1 block text-sm font-medium text-neutral-700">
          What I&apos;m exploring
        </label>
        <textarea
          id="exploring"
          value={exploring}
          onChange={(event) => setExploring(event.target.value)}
          className="min-h-28 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          maxLength={2000}
        />
      </div>

      <div>
        <label htmlFor="helpWanted" className="mb-1 block text-sm font-medium text-neutral-700">
          What I want help with
        </label>
        <textarea
          id="helpWanted"
          value={helpWanted}
          onChange={(event) => setHelpWanted(event.target.value)}
          className="min-h-28 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          maxLength={2000}
        />
      </div>

      <div>
        <label htmlFor="tags" className="mb-1 block text-sm font-medium text-neutral-700">
          Tags (comma separated)
        </label>
        <input
          id="tags"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={openToMatching}
          onChange={(event) => setOpenToMatching(event.target.checked)}
          disabled={isPending}
        />
        Open to matching when saved
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runAction('save_beacon')}
          disabled={isPending}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save Beacon
        </button>
        <button
          type="button"
          onClick={() => runAction('save_draft')}
          disabled={isPending}
          className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={() => runAction('discard')}
          disabled={isPending}
          className="rounded-full border border-red-300 px-5 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
        >
          Discard Draft
        </button>
      </div>
    </section>
  );
}
