'use client';

import React from 'react';
import { toast } from 'sonner';
import { updatePostDetails } from '@/actions/community';
import { Loader2 } from '@/components/icons';
import TagInput from '@/components/TagInput';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type PostDetails = { id: string; name: string; description: string; tags: string[] };

/** Title, description and tags of a post, without opening the flag maker (uploaded flags have no design). */
export default function EditPostDetailsDialog({
  post,
  open,
  onOpenChange,
  onSaved,
}: {
  post: PostDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (details: PostDetails) => void;
}) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open && post) {
      setName(post.name);
      setDescription(post.description);
      setTags(post.tags);
    }
  }, [open, post]);

  async function save() {
    if (!post) return;
    setBusy(true);
    try {
      const result = await updatePostDetails({ id: post.id, name, description, tags });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      onSaved({ id: post.id, name: name.trim(), description: description.trim(), tags });
      onOpenChange(false);
      toast.success('Saved');
    } catch {
      toast.error('Couldn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[calc(100%-2rem)] max-w-[460px] gap-4 sm:max-w-[460px]'>
        <DialogTitle>Edit details</DialogTitle>
        <DialogDescription className='sr-only'>Change the title, description and tags</DialogDescription>
        <div className='space-y-1.5'>
          <label htmlFor='post-details-name' className='text-[13px] font-medium'>Title</label>
          <Input id='post-details-name' value={name} maxLength={120} onChange={(e) => setName(e.target.value)} disabled={busy} />
        </div>
        <div className='space-y-1.5'>
          <label htmlFor='post-details-description' className='text-[13px] font-medium'>Description</label>
          <textarea
            id='post-details-description'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            disabled={busy}
            className='vx-well w-full resize-none rounded-[12px] px-3.5 py-3 text-[14px] outline-none focus:ring-2 focus:ring-ring'
          />
        </div>
        <TagInput tags={tags} onTagsChange={(next) => setTags(next.filter((tag) => !['custom', 'remix'].includes(tag.toLowerCase())))} maxTags={8} placeholder='Add tags…' />
        <div className='flex justify-end gap-2'>
          <Button variant='neutral' onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy && <Loader2 className='animate-spin' />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
