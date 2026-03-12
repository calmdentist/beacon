import type { CreateBeaconInput } from '@beacon/core';

import { canonicalizeBeaconText } from '../matching/canonicalize';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

interface OpenAIEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  model?: string;
}

export interface BeaconEmbeddingTextInput {
  title: string;
  summary: string;
  exploring: string;
  helpWanted: string;
  tags: string[];
}

export interface BeaconEmbeddingResult {
  canonicalText: string;
  embedding: number[];
  model: string;
}

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

export function getEmbeddingDimensions(): number {
  const raw = process.env.EMBEDDING_DIMENSIONS?.trim();
  const parsed = raw ? Number(raw) : NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return DEFAULT_EMBEDDING_DIMENSIONS;
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generateBeaconEmbedding(
  input: BeaconEmbeddingTextInput
): Promise<BeaconEmbeddingResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const model = getEmbeddingModel();
  const dimensions = getEmbeddingDimensions();
  const canonicalText = canonicalizeBeaconText(toCreateBeaconInput(input));

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: canonicalText,
        dimensions
      })
    });

    if (!response.ok) {
      console.warn(`OpenAI embedding request failed: ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as OpenAIEmbeddingResponse;
    const embedding = payload.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.warn('OpenAI embedding response did not include a vector.');
      return null;
    }

    return {
      canonicalText,
      embedding,
      model: payload.model ?? model
    };
  } catch (error) {
    console.warn('OpenAI embedding request failed unexpectedly.', error);
    return null;
  }
}

function toCreateBeaconInput(input: BeaconEmbeddingTextInput): CreateBeaconInput {
  return {
    title: input.title,
    summary: input.summary,
    exploring: input.exploring,
    helpWanted: input.helpWanted,
    tags: input.tags,
    sourceType: 'manual',
    status: 'saved',
    isMatchable: true
  };
}
