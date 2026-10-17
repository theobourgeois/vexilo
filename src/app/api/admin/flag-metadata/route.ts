import { generateAndStoreFlagAiMetadata } from '@/lib/ai/flag-metadata-pipeline';
import { getServerAuthSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

// The pipeline researches the flag with web search, which can take a minute or two.
export const maxDuration = 300;

/** Regenerates AI metadata (description, tags, traits, search data) for one flag. */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { flagId?: unknown } | null;
  const flagId = typeof body?.flagId === 'string' ? body.flagId : '';
  if (!flagId) {
    return NextResponse.json({ message: 'Missing flagId.' }, { status: 400 });
  }

  try {
    const result = await generateAndStoreFlagAiMetadata({ flagId });
    if (!result.persisted) {
      return NextResponse.json(
        { message: result.persistenceError || 'Generated, but could not save.' },
        { status: 500 },
      );
    }
    return NextResponse.json({
      descriptionDraft: result.payload.descriptionDraft,
      tagsDraft: result.payload.tagsDraft,
      estimatedCostUsd: result.requestUsage?.estimatedCostUsd ?? null,
    });
  } catch (error) {
    console.error('Flag metadata generation failed', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Generation failed.' },
      { status: 500 },
    );
  }
}
