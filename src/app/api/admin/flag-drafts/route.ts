import { createFlagDraft, type FlagImageMode } from '@/lib/ai/create-flag-draft';
import { getServerAuthSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Research with web search plus drawing an SVG can take a minute or two.
export const maxDuration = 300;

const IMAGE_MODES: FlagImageMode[] = ['commons-first', 'draw', 'commons-only'];

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    input?: unknown;
    image?: unknown;
    research?: unknown;
  } | null;
  const input = typeof body?.input === 'string' ? body.input.trim() : '';
  if (!input || input.length > 500) {
    return NextResponse.json({ message: 'Type a flag name or description (500 characters max).' }, { status: 400 });
  }
  const image = IMAGE_MODES.includes(body?.image as FlagImageMode) ? (body?.image as FlagImageMode) : 'commons-first';

  try {
    const draft = await createFlagDraft(input, { image, research: body?.research !== false });
    return NextResponse.json(draft);
  } catch (error) {
    console.error('Flag draft generation failed', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Generation failed.' },
      { status: 500 },
    );
  }
}
