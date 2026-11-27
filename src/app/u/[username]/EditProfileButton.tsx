'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import { toast } from 'sonner';
import { loadPosts, updateProfile } from '@/actions/community';
import FlagImage from '@/components/FlagImage';
import { Check, Edit, Loader2, PushPin, Settings } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { PostCard, Profile } from '@/lib/posts';
import { cn } from '@/lib/utils';

const PINNED_MAX = 3;

type ProfileFlagChoice = { kind: 'post' | 'flag'; id: string } | null;

/** Edit profile, for the person whose profile it is. Username and picture live in settings. */
export default function EditProfileButton({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [bio, setBio] = React.useState(profile.bio);
  const [link, setLink] = React.useState(profile.link);
  const [location, setLocation] = React.useState(profile.location);
  const [flag, setFlag] = React.useState<ProfileFlagChoice>(null);
  const [pinned, setPinned] = React.useState<string[]>(profile.pinnedPostIds);
  const [posts, setPosts] = React.useState<PostCard[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  const realFavorite = profile.profileFlag?.kind === 'flag' ? profile.profileFlag : null;

  React.useEffect(() => {
    if (!open) return;
    setBio(profile.bio);
    setLink(profile.link);
    setLocation(profile.location);
    setPinned(profile.pinnedPostIds);
    setFlag(profile.profileFlag ? { kind: profile.profileFlag.kind, id: profile.profileFlag.id } : null);
    if (posts === null) {
      loadPosts({ authorId: profile.id, sort: 'popular', range: 'all' })
        .then((page) => setPosts(page.posts))
        .catch(() => setPosts([]));
    }
  }, [open, profile, posts]);

  async function save() {
    setBusy(true);
    try {
      const result = await updateProfile({ bio, link, location, profileFlag: flag, pinnedPostIds: pinned });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      setOpen(false);
      toast.success('Profile saved');
      router.refresh();
    } catch {
      toast.error('Couldn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const togglePin = (id: string) =>
    setPinned((current) => {
      if (current.includes(id)) return current.filter((other) => other !== id);
      if (current.length >= PINNED_MAX) {
        toast.error(`You can pin up to ${PINNED_MAX}.`);
        return current;
      }
      return [...current, id];
    });

  return (
    <>
      <Button variant='neutral' onClick={() => setOpen(true)}>
        <Edit />
        Edit profile
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] gap-5 overflow-y-auto sm:max-w-[560px]'>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription className='-mt-3 text-[13px]'>
            Change your username or picture in{' '}
            <Link href='/settings' className='inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2'>
              <Settings className='size-3.5' />
              settings
            </Link>
            .
          </DialogDescription>

          <Field id='profile-bio' label='Bio' hint={`${bio.length}/160`}>
            <textarea
              id='profile-bio'
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              rows={3}
              disabled={busy}
              placeholder='What kind of flags do you make?'
              className='vx-well w-full resize-none rounded-[12px] px-3.5 py-3 text-[14px] outline-none focus:ring-2 focus:ring-ring'
            />
          </Field>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field id='profile-link' label='Link'>
              <Input id='profile-link' value={link} maxLength={200} placeholder='https://' onChange={(e) => setLink(e.target.value)} disabled={busy} />
            </Field>
            <Field id='profile-location' label='Location'>
              <Input id='profile-location' value={location} maxLength={60} onChange={(e) => setLocation(e.target.value)} disabled={busy} />
            </Field>
          </div>

          <Field label='Profile flag' hint='Colours your banner'>
            <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
              <Choice selected={flag === null} onClick={() => setFlag(null)}>
                <span className='text-[12px] text-muted-foreground'>None</span>
              </Choice>
              {realFavorite && (
                <Choice selected={flag?.kind === 'flag' && flag.id === realFavorite.id} onClick={() => setFlag({ kind: 'flag', id: realFavorite.id })} title={realFavorite.name}>
                  <FlagImage src={realFavorite.image} alt={realFavorite.name} maxHeight={40} fixed />
                </Choice>
              )}
              {posts === null ? (
                <span className='col-span-2 flex items-center gap-2 text-[13px] text-muted-foreground'>
                  <Loader2 className='size-4 animate-spin' /> Loading your designs…
                </span>
              ) : (
                posts.map((post) => (
                  <Choice key={post.id} selected={flag?.kind === 'post' && flag.id === post.id} onClick={() => setFlag({ kind: 'post', id: post.id })} title={post.name}>
                    <FlagImage src={post.image} alt={post.name} maxHeight={40} fixed />
                  </Choice>
                ))
              )}
            </div>
          </Field>

          {posts && posts.length > 0 && (
            <Field label='Pinned designs' hint={`${pinned.length}/${PINNED_MAX}`}>
              <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
                {posts.map((post) => {
                  const index = pinned.indexOf(post.id);
                  return (
                    <Choice key={post.id} selected={index >= 0} onClick={() => togglePin(post.id)} title={post.name}>
                      <FlagImage src={post.image} alt={post.name} maxHeight={40} fixed />
                      {index >= 0 && (
                        <span className='absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background'>
                          {index + 1}
                        </span>
                      )}
                    </Choice>
                  );
                })}
              </div>
              <p className='mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground'>
                <PushPin className='size-3.5' /> Pinned designs sit at the top of your profile, in the order you pick them.
              </p>
            </Field>
          )}

          <div className='flex justify-end gap-2'>
            <Button variant='neutral' onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className='animate-spin' /> : <Check />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className='space-y-1.5'>
      <div className='flex items-baseline justify-between'>
        <label htmlFor={id} className='text-[13px] font-medium'>
          {label}
        </label>
        {hint && <span className='tabular-nums text-[12px] text-muted-foreground'>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Choice({ selected, onClick, title, children }: { selected: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      type='button'
      title={title}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'bg-stage relative flex h-[64px] items-center justify-center rounded-[12px] p-2 transition-shadow',
        selected ? 'ring-2 ring-foreground' : 'ring-1 ring-line hover:ring-foreground/40',
      )}
    >
      {children}
    </button>
  );
}
