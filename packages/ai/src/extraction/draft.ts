import type { BeaconDraftFromContextInput, BeaconDraft } from '@beacon/core';

const MAX_SUMMARY_LENGTH = 220;

export function draftBeaconFromContext(input: BeaconDraftFromContextInput, reviewUrl: string): BeaconDraft {
  const source = input.conversationContext.trim();
  const sentences = source.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary = input.summary ?? truncate(sentences.slice(0, 2).join(' '), MAX_SUMMARY_LENGTH);

  return {
    draftId: crypto.randomUUID(),
    title: input.title ?? inferTitle(sentences[0] ?? source),
    summary,
    exploring: summary,
    helpWanted: 'Need adjacent perspectives, counterarguments, and relevant references.',
    tags: inferTags(source),
    suggestedMatchable: true,
    reviewUrl
  };
}

function inferTitle(raw: string): string {
  const clean = raw.replace(/\s+/g, ' ').trim();
  return truncate(clean || 'Untitled inquiry', 80);
}

function inferTags(text: string): string[] {
  const stopWords = new Set(['the', 'and', 'with', 'this', 'that', 'from', 'what', 'have']);

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3 && !stopWords.has(token));

  return Array.from(new Set(tokens)).slice(0, 5);
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}...`;
}
