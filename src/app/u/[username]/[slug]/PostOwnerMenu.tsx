'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import { toast } from 'sonner';
import { setPinned, unpublishPost } from '@/actions/community';
import EditPostDetailsDialog, { type PostDetails } from '@/components/community/EditPostDetailsDialog';
import { Edit, EyeClosed, Loader2, MoreHorizontal, Pencil, PushPin } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** What the author can do on their own post: edit it, pin it, or take it down. */
export default function PostOwnerMenu({
  post,
  hasDesign,
  pinned: initialPinned,
  profileHref,
}: {
  post: PostDetails;
  hasDesign: boolean;
  pinned: boolean;
  profileHref: string;
}) {
  const router = useRouter();
  const [details, setDetails] = React.useState(false);
  const [takingDown, setTakingDown] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [pinned, setPinnedState] = React.useState(initialPinned);

  async function togglePin() {
    const result = await setPinned(post.id, !pinned);
    if (!result.success) return toast.error(result.message);
    setPinnedState(!pinned);
    toast.success(pinned ? 'Unpinned' : 'Pinned to your profile');
  }

  async function takeDown() {
    setBusy(true);
    try {
      const result = await unpublishPost(post.id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success('Taken down. It’s a draft in My flags again.');
      router.push(profileHref);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {hasDesign && (
        <Button variant='neutral' asChild>
          <Link href={`/create?flag=${post.id}`}>
            <Edit />
            Edit in maker
          </Link>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='neutral' size='icon' aria-label='More'>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-52'>
          <DropdownMenuItem onClick={() => setDetails(true)}>
            <Pencil />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={togglePin}>
            <PushPin weight={pinned ? 'fill' : 'bold'} />
            {pinned ? 'Unpin from profile' : 'Pin to profile'}
          </DropdownMenuItem>
          {/* Uploaded flags have no design, so they couldn't be posted again; they can only be deleted. */}
          {hasDesign && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTakingDown(true)} className='text-bad focus:bg-bad-soft focus:text-bad'>
                <EyeClosed />
                Take down
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPostDetailsDialog post={post} open={details} onOpenChange={setDetails} onSaved={() => router.refresh()} />

      <Dialog open={takingDown} onOpenChange={setTakingDown}>
        <DialogContent className='w-[calc(100%-2rem)] max-w-[420px] gap-4 sm:max-w-[420px]'>
          <DialogTitle>Take this post down?</DialogTitle>
          <DialogDescription>
            It comes off your profile and its link stops working. It stays in My flags as a draft, and posting it again brings back
            the same link. Its likes are kept.
          </DialogDescription>
          <div className='flex justify-end gap-2'>
            <Button variant='neutral' onClick={() => setTakingDown(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant='danger' onClick={takeDown} disabled={busy}>
              {busy && <Loader2 className='animate-spin' />}
              Take down
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
