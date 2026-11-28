'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteMyFlag, duplicateMyFlag, type MyFlag } from '@/actions/my-flags';
import FlagImage from '@/components/FlagImage';
import EditPostDetailsDialog, { type PostDetails } from '@/components/community/EditPostDetailsDialog';
import { Check, Copy, Edit, ExternalLink, Flag, GoogleLogo, Heart, Loader2, MoreHorizontal, Pencil, Plus, Shuffle, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Segmented } from '@/components/ui/segmented';
import { openSignIn } from '@/lib/sign-in';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'drafts' | 'posted';

const FILTERS: Record<Filter, (flag: MyFlag) => boolean> = {
  all: () => true,
  drafts: (flag) => flag.status === 'draft',
  posted: (flag) => flag.status === 'posted',
};

function timeAgo(date: Date) {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, 'year'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, unit] of units) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return value === 1 && unit === 'day' ? 'yesterday' : `${value} ${unit}${value === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

const pill = 'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold [&_svg]:size-3';

function StatusPill({ flag }: { flag: MyFlag }) {
  if (flag.status === 'posted') {
    return (
      <span className={cn(pill, 'bg-[rgb(34_160_90/0.13)] text-[#17794a] dark:bg-[rgb(80_200_130/0.14)] dark:text-[#6fd39b]')}>
        <Check />
        Posted
        {flag.likes > 0 && (
          <span className='inline-flex items-center gap-1 font-medium opacity-80'>
            · <Heart weight='fill' /> {flag.likes.toLocaleString()}
          </span>
        )}
      </span>
    );
  }
  return <span className={cn(pill, 'bg-foreground/[0.06] text-subtle')}>Draft</span>;
}

function FlagTile({
  flag,
  onDuplicate,
  onDelete,
  onEditDetails,
  busy,
}: {
  flag: MyFlag;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditDetails: () => void;
  busy: boolean;
}) {
  // Flags uploaded as pictures have no design to open, so they open their post.
  const editHref = flag.hasDesign ? `/create?flag=${flag.id}` : (flag.path ?? '/my-flags');
  return (
    <article className='vx-tile group relative flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-tile-hover'>
      <Link href={editHref} aria-label={`Edit ${flag.name}`} className='flag-stage bg-stage relative h-[208px] px-6 py-7'>
        <FlagImage src={flag.image} alt={flag.name} maxHeight={160} area={240 * 160} />
        <span className='absolute left-2.5 top-2.5'>
          <StatusPill flag={flag} />
        </span>
      </Link>

      <div className='flex items-center gap-2 py-3 pl-4 pr-2.5'>
        <div className='min-w-0 flex-1'>
          <h3 className='truncate text-[15px] font-medium'>
            <Link href={editHref}>{flag.name}</Link>
          </h3>
          <p className='mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11.5px] text-muted-foreground'>
            {flag.remixOfName && (
              <>
                <Shuffle className='size-3 shrink-0' />
                <span className='truncate'>{flag.remixOfName.replace(/^the /, '')} ·</span>
              </>
            )}
            <span className='shrink-0'>Edited {timeAgo(flag.updatedAt)}</span>
          </p>
        </div>
        {flag.hasDesign ? (
          <Button variant='neutral' size='sm' asChild>
            <Link href={editHref}>
              <Edit />
              Edit
            </Link>
          </Button>
        ) : (
          <Button variant='neutral' size='sm' onClick={onEditDetails}>
            <Pencil />
            Details
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon-sm' aria-label={`More for ${flag.name}`} disabled={busy}>
              {busy ? <Loader2 className='animate-spin' /> : <MoreHorizontal />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {flag.path && (
              <DropdownMenuItem asChild>
                <Link href={flag.path}>
                  <ExternalLink />
                  View post
                </Link>
              </DropdownMenuItem>
            )}
            {flag.hasDesign && flag.status === 'posted' && (
              <DropdownMenuItem onClick={onEditDetails}>
                <Pencil />
                Edit details
              </DropdownMenuItem>
            )}
            {flag.hasDesign && (
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy />
                Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className='text-bad focus:text-bad'>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

function Header({ count, children }: { count?: number; children?: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-4 pb-[18px] pt-7 sm:flex-row sm:items-end sm:justify-between'>
      <div>
        <h1 className='flex items-baseline gap-2.5 text-[22px] font-semibold tracking-[-0.03em]'>
          My flags
          {count !== undefined && count > 0 && (
            <span className='tabular-nums text-sm font-normal tracking-normal text-muted-foreground'>{count.toLocaleString()}</span>
          )}
        </h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>Everything you’ve designed: drafts only you can see, and posts on your profile.</p>
      </div>
      {children}
    </div>
  );
}

function Empty({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className='vx-tile flex flex-col items-center gap-3 px-6 py-16 text-center'>
      <div className='text-muted-foreground [&_svg]:size-8'>{icon}</div>
      <h2 className='text-lg font-semibold'>{title}</h2>
      <p className='max-w-[380px] text-sm text-muted-foreground'>{body}</p>
      <div className='mt-2'>{action}</div>
    </div>
  );
}

export function MyFlagsSignedOut() {
  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-16 md:px-8'>
      <Header />
      <Empty
        icon={<Flag />}
        title='Sign in to see your flags'
        body='Flags you save in the flag maker are kept here, so you can come back and keep working on them.'
        action={
          <Button variant='neutral' onClick={() => openSignIn()}>
            <GoogleLogo />
            Sign in
          </Button>
        }
      />
    </div>
  );
}

export default function MyFlags({ flags: initial }: { flags: MyFlag[] }) {
  const router = useRouter();
  const [flags, setFlags] = React.useState(initial);
  const [filter, setFilter] = React.useState<Filter>('all');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<MyFlag | null>(null);
  const [details, setDetails] = React.useState<PostDetails | null>(null);
  React.useEffect(() => setFlags(initial), [initial]);

  const shown = flags.filter(FILTERS[filter]);
  const counts = {
    drafts: flags.filter(FILTERS.drafts).length,
    posted: flags.filter(FILTERS.posted).length,
  };

  async function duplicate(flag: MyFlag) {
    setBusy(flag.id);
    const result = await duplicateMyFlag(flag.id).catch(() => null);
    setBusy(null);
    if (!result?.success) {
      toast.error(result?.message ?? 'Couldn’t copy that flag. Try again.');
      return;
    }
    toast.success(`Copied ${flag.name}`, { action: { label: 'Edit', onClick: () => router.push(`/create?flag=${result.id}`) } });
    router.refresh();
  }

  async function remove(flag: MyFlag) {
    setDeleting(null);
    setBusy(flag.id);
    const result = await deleteMyFlag(flag.id).catch(() => null);
    setBusy(null);
    if (!result?.success) {
      toast.error(result?.message ?? 'Couldn’t delete that flag. Try again.');
      return;
    }
    setFlags((current) => current.filter((f) => f.id !== flag.id));
    toast.success(`Deleted ${flag.name}`);
  }

  const newFlag = (
    <Button asChild>
      <Link href='/create'>
        <Plus />
        New flag
      </Link>
    </Button>
  );

  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-16 md:px-8'>
      <Header count={flags.length}>{flags.length > 0 && newFlag}</Header>

      {flags.length === 0 ? (
        <Empty
          icon={<Flag />}
          title='No flags yet'
          body='Design a flag in the flag maker and press Save. Drafts stay here, just for you, until you post them.'
          action={newFlag}
        />
      ) : (
        <>
          <Segmented
            aria-label='Show'
            value={filter}
            onChange={setFilter}
            className='mb-5 max-w-full overflow-x-auto'
            options={[
              { value: 'all', label: 'All' },
              { value: 'drafts', label: `Drafts${counts.drafts ? ` · ${counts.drafts}` : ''}` },
              { value: 'posted', label: `Posted${counts.posted ? ` · ${counts.posted}` : ''}` },
            ]}
          />
          {shown.length === 0 ? (
            <p className='vx-tile px-6 py-12 text-center text-sm text-muted-foreground'>
              {filter === 'posted' ? 'You haven’t posted any flags yet. Open one and press Post.' : 'Every flag here is posted.'}
            </p>
          ) : (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {shown.map((flag) => (
                <FlagTile
                  key={flag.id}
                  flag={flag}
                  busy={busy === flag.id}
                  onDuplicate={() => duplicate(flag)}
                  onDelete={() => setDeleting(flag)}
                  onEditDetails={() => setDetails({ id: flag.id, name: flag.name, description: flag.description, tags: flag.tags })}
                />
              ))}
            </div>
          )}
        </>
      )}

      <EditPostDetailsDialog
        post={details}
        open={details !== null}
        onOpenChange={(open) => !open && setDetails(null)}
        onSaved={(saved) => setFlags((current) => current.map((f) => (f.id === saved.id ? { ...f, ...saved } : f)))}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className='w-[calc(100%-2rem)] max-w-[420px] gap-4 sm:max-w-[420px]'>
          <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          <DialogDescription className='text-[13.5px] text-subtle'>
            {deleting?.status === 'posted'
              ? 'It comes off your profile too, with its likes, and its link stops working. This can’t be undone. To keep it but hide it, open it and take the post down instead.'
              : 'This can’t be undone.'}
          </DialogDescription>
          <div className='flex justify-end gap-2'>
            <Button variant='neutral' onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant='danger' onClick={() => deleting && remove(deleting)}>
              <Trash2 />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
