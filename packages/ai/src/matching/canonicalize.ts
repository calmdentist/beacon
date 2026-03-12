import type { CreateBeaconInput } from '@beacon/core';

export function canonicalizeBeaconText(input: CreateBeaconInput): string {
  const tags = input.tags.join(', ');

  return [
    `Title: ${input.title}`,
    `Summary: ${input.summary}`,
    `Exploring: ${input.exploring}`,
    `Help wanted: ${input.helpWanted}`,
    `Tags: ${tags}`
  ].join('\n');
}
