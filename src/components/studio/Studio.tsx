'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import type { StudioContest } from '@/actions/contests';
import { saveMyFlag, type SavedFlagSource, type SavedFlagStatus } from '@/actions/my-flags';
import { Loader2 } from '@/components/icons';
import { openSignIn } from '@/lib/sign-in';
import type { Gallery } from './chrome';
import { DesktopStudio } from './DesktopStudio';
import { blobToDataUrl, decodeDoc, designToPng } from './export';
import { migrateDesign } from './field';
import { MobileStudio } from './MobileStudio';
import { newDesign, type RemixSource, type StudioDoc, type StudioEmblem } from './model';
import { buildRemixDesign } from './remix';
import { useStudio } from './use-studio';

const draftKey = (remixId: string | null, contestSlug: string | null, savedId: string | null) =>
  `vexilo-flag-maker:${contestSlug ? `contest-${contestSlug}` : savedId ? `saved-${savedId}` : (remixId ?? 'new')}`;

/** JSON with object keys sorted: the database hands designs back with their keys reordered. */
const stableJson = (value: unknown) =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );

/** What's compared to tell whether there's anything left to save. */
const snapshot = (doc: StudioDoc) => stableJson({ name: doc.name, design: doc.design });

/** The picture kept in My flags; the gallery shows it small. */
const THUMBNAIL_WIDTH = 800;

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

/** The emblem library, fetched after the page loads; null until it arrives. */
function useEmblemLibrary() {
  const [emblems, setEmblems] = React.useState<StudioEmblem[] | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch('/api/studio-emblems')
      .then((response) => (response.ok ? (response.json() as Promise<StudioEmblem[]>) : Promise.reject(new Error(String(response.status)))))
      .then((library) => live && setEmblems(library))
      .catch(() => {
        if (!live) return;
        setEmblems([]);
        toast.error("Couldn't load the emblem library");
      });
    return () => {
      live = false;
    };
  }, []);
  return emblems;
}

export default function Studio({
  remix,
  contest = null,
  saved = null,
  onAdopt,
}: {
  remix: RemixSource | null;
  contest?: StudioContest | null;
  /** One of the person's own flags, opened from My flags. */
  saved?: SavedFlagSource | null;
  /** Called when a new flag becomes one of the person's saved flags. */
  onAdopt?: (id: string) => void;
}) {
  const router = useRouter();
  const session = useSession();
  const emblems = useEmblemLibrary();
  // A remix brings the emblems its design uses, so it can be edited before the library arrives.
  const vectorEmblems = React.useMemo(
    () => new Set([...(emblems ?? []), ...(remix?.placements.map((p) => p.emblem) ?? [])].filter((e) => e.vector).map((e) => e.id)),
    [emblems, remix],
  );
  const startName = saved?.name ?? contest?.entry?.title ?? (remix ? `${remix.name.replace(/^the /, '')} remix` : 'Untitled flag');
  const studio = useStudio({ name: startName, design: newDesign() }, vectorEmblems);
  const [ready, setReady] = React.useState(false);
  const mobile = useIsMobile();
  const [savedId, setSavedId] = React.useState(saved?.id ?? null);
  const [standing, setStanding] = React.useState<{
    status: SavedFlagStatus | null;
    updatePending: boolean;
    flagName: string | null;
    post: { description: string; tags: string[] };
  }>({
    status: saved?.status ?? null,
    updatePending: saved?.updatePending ?? false,
    flagName: saved?.flagName ?? null,
    post: saved?.post ?? { description: '', tags: [] },
  });
  const [lastSaved, setLastSaved] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const key = draftKey(remix?.id ?? null, contest?.slug ?? null, savedId);
  const reset = studio.actions.reset;
  const restore = studio.actions.restore;

  // What "start over" goes back to: the submitted entry, the remixed flag as first opened, or a blank flag.
  const original = React.useRef<Promise<StudioDoc> | null>(null);
  const getOriginal = React.useCallback(() => {
    const entry = saved?.design ?? contest?.entry?.design;
    original.current ??= (
      entry ? Promise.resolve(migrateDesign(entry)) : remix ? buildRemixDesign(remix).catch(() => newDesign()) : Promise.resolve(newDesign())
    ).then((design) => ({
      name: startName,
      design,
    }));
    return original.current;
  }, [remix, contest, saved, startName]);
  const [originalDoc, setOriginalDoc] = React.useState<StudioDoc | null>(null);
  React.useEffect(() => {
    getOriginal().then(setOriginalDoc);
  }, [getOriginal]);

  const startOver = React.useCallback(async () => {
    restore(await getOriginal());
    toast(savedId ? 'Back to your last save' : remix ? 'Back to the original' : 'Started over', {
      action: { label: 'Undo', onClick: () => studio.history.undo() },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undo is stable
  }, [getOriginal, restore, remix, savedId]);
  const changed = originalDoc !== null && stableJson(originalDoc.design) !== stableJson(studio.doc.design);

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
      // A saved flag opens as it was saved, so only changes after that need saving.
      if (saved) setLastSaved(snapshot(start));
      if (draft && snapshot(draft) !== snapshot(start)) {
        reset(draft);
        // Coming back to an edited remix should never feel like a trap.
        toast(saved ? 'Picked up your unsaved changes' : 'Picked up where you left off', {
          action: { label: saved ? 'Discard' : remix ? 'Back to original' : 'Start over', onClick: () => restore(start) },
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

  const remixLink = remix ? { id: remix.id, name: remix.name } : (saved?.remix ?? null);

  // The latest design, for saves that finish after it changes again.
  const docRef = React.useRef(studio.doc);
  docRef.current = studio.doc;
  const savingRef = React.useRef(false);

  /** From now on this is one of the person's flags: its own draft, address and "start over". */
  const adopt = React.useCallback(
    (id: string, doc: StudioDoc) => {
      setLastSaved(snapshot(doc));
      original.current = Promise.resolve(doc);
      setOriginalDoc(doc);
      if (id === savedId) return;
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing to clear.
      }
      setSavedId(id);
      onAdopt?.(id);
      window.history.replaceState(null, '', `/create?flag=${id}`);
    },
    [key, savedId, onAdopt],
  );

  const save = React.useCallback(async () => {
    if (savingRef.current || contest) return;
    if (session.status === 'unauthenticated') {
      toast('Sign in to save your flags', { action: { label: 'Sign in', onClick: () => openSignIn() } });
      return;
    }
    const doc = docRef.current;
    if (savedId && snapshot(doc) === lastSaved) {
      toast('Already saved', { action: { label: 'My flags', onClick: () => router.push('/my-flags') } });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const image = await blobToDataUrl(await designToPng(doc.design, THUMBNAIL_WIDTH));
      const result = await saveMyFlag({ id: savedId, name: doc.name, design: doc.design, image, remixOf: remixLink?.id ?? null });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      const first = !savedId;
      adopt(result.id, doc);
      if (first) {
        setStanding((s) => ({ ...s, status: 'draft' }));
        toast.success('Saved to My flags', { action: { label: 'View', onClick: () => router.push('/my-flags') } });
      } else {
        toast.success(standing.status === 'posted' ? 'Saved. Post an update to change it on Browse.' : 'Saved');
      }
    } catch {
      toast.error('Couldn’t save your flag. Try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [contest, session.status, savedId, lastSaved, remixLink?.id, adopt, router, standing.status]);

  const gallery: Gallery = {
    savedId,
    ...standing,
    dirty: lastSaved === null || snapshot(studio.doc) !== lastSaved,
    saving,
    save,
    onPosted: (result) => {
      adopt(result.savedId, docRef.current);
      setStanding((s) => ({
        // A live flag stays live while its update waits.
        status: result.published || result.update || s.status === 'posted' ? 'posted' : 'review',
        updatePending: !result.published && (result.update || s.status === 'posted'),
        flagName: result.flagName ?? s.flagName,
        post: { description: result.description, tags: result.tags },
      }));
    },
  };

  if (!ready || mobile === null) {
    return (
      <div className='grid h-[calc(100dvh-64px)] place-items-center bg-stage text-muted-foreground'>
        <Loader2 className='size-6 animate-spin' />
      </div>
    );
  }
  const startOverProps = { onStartOver: changed ? startOver : undefined, startOverLabel: savedId ? 'Revert' : undefined };
  return mobile ? (
    <MobileStudio studio={studio} emblems={emblems} remix={remixLink} contest={contest} gallery={gallery} {...startOverProps} />
  ) : (
    <DesktopStudio studio={studio} emblems={emblems} remix={remixLink} contest={contest} gallery={gallery} {...startOverProps} />
  );
}
