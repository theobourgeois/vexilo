'use client';

import React from 'react';
import { toast } from 'sonner';
import type { StudioContest } from '@/actions/contests';
import { Loader2 } from '@/components/icons';
import { DesktopStudio } from './DesktopStudio';
import { decodeDoc } from './export';
import { migrateDesign } from './field';
import { MobileStudio } from './MobileStudio';
import { newDesign, type RemixSource, type StudioDoc, type StudioEmblem } from './model';
import { buildRemixDesign } from './remix';
import { useStudio } from './use-studio';

const draftKey = (remixId: string | null, contestSlug: string | null) =>
  `vexilo-flag-maker:${contestSlug ? `contest-${contestSlug}` : (remixId ?? 'new')}`;

function loadDraft(key: string): StudioDoc | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    // Drafts from before divisions are opened in the current version.
    return (value?.design?.version === 1 || value?.design?.version === 2) && typeof value.name === 'string'
      ? { name: value.name, design: migrateDesign(value.design) }
      : null;
  } catch {
    return null;
  }
}

function useIsMobile() {
  const [mobile, setMobile] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return mobile;
}

export default function Studio({
  emblems,
  remix,
  contest = null,
}: {
  emblems: StudioEmblem[];
  remix: RemixSource | null;
  contest?: StudioContest | null;
}) {
  const vectorEmblems = React.useMemo(
    () => new Set([...emblems, ...(remix?.placements.map((p) => p.emblem) ?? [])].filter((e) => e.vector).map((e) => e.id)),
    [emblems, remix],
  );
  const startName = contest?.entry?.title ?? (remix ? `${remix.name.replace(/^the /, '')} remix` : 'Untitled flag');
  const studio = useStudio({ name: startName, design: newDesign() }, vectorEmblems);
  const [ready, setReady] = React.useState(false);
  const mobile = useIsMobile();
  const key = draftKey(remix?.id ?? null, contest?.slug ?? null);
  const reset = studio.actions.reset;
  const restore = studio.actions.restore;

  // What "start over" goes back to: the submitted entry, the remixed flag as first opened, or a blank flag.
  const original = React.useRef<Promise<StudioDoc> | null>(null);
  const getOriginal = React.useCallback(() => {
    const entry = contest?.entry?.design;
    original.current ??= (
      entry ? Promise.resolve(migrateDesign(entry)) : remix ? buildRemixDesign(remix).catch(() => newDesign()) : Promise.resolve(newDesign())
    ).then((design) => ({
      name: startName,
      design,
    }));
    return original.current;
  }, [remix, contest, startName]);
  const [originalDoc, setOriginalDoc] = React.useState<StudioDoc | null>(null);
  React.useEffect(() => {
    getOriginal().then(setOriginalDoc);
  }, [getOriginal]);

  const startOver = React.useCallback(async () => {
    restore(await getOriginal());
    toast(remix ? 'Back to the original' : 'Started over', { action: { label: 'Undo', onClick: () => studio.history.undo() } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undo is stable
  }, [getOriginal, restore, remix]);
  const changed = originalDoc !== null && JSON.stringify(originalDoc.design) !== JSON.stringify(studio.doc.design);

  // Start from a share link, else a saved draft, else the remixed flag (or a fresh design).
  React.useEffect(() => {
    let live = true;
    (async () => {
      const hash = window.location.hash.match(/^#d=(.+)$/);
      if (hash) {
        const shared = await decodeDoc(hash[1]);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        if (shared && live) {
          reset(shared);
          setReady(true);
          return;
        }
      }
      const draft = loadDraft(key);
      const start = await getOriginal();
      if (!live) return;
      if (draft && (draft.name !== start.name || JSON.stringify(draft.design) !== JSON.stringify(start.design))) {
        reset(draft);
        // Coming back to an edited remix should never feel like a trap.
        toast('Picked up where you left off', {
          action: { label: remix ? 'Back to original' : 'Start over', onClick: () => restore(start) },
          duration: 8000,
        });
      } else {
        reset(start);
      }
      setReady(true);
    })();
    return () => {
      live = false;
    };
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify(studio.doc));
      } catch {
        // Storage full or blocked; the design just isn't kept.
      }
    };
    const timer = setTimeout(save, 400);
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', save);
    };
  }, [studio.doc, ready, key]);

  const remixLink = remix ? { id: remix.id, name: remix.name } : null;

  if (!ready || mobile === null) {
    return (
      <div className='grid h-[calc(100dvh-64px)] place-items-center bg-stage text-muted-foreground'>
        <Loader2 className='size-6 animate-spin' />
      </div>
    );
  }
  const startOverProps = { onStartOver: changed ? startOver : undefined };
  return mobile ? (
    <MobileStudio studio={studio} emblems={emblems} remix={remixLink} contest={contest} {...startOverProps} />
  ) : (
    <DesktopStudio studio={studio} emblems={emblems} remix={remixLink} contest={contest} {...startOverProps} />
  );
}
