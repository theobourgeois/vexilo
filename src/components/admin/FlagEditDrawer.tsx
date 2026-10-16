'use client';

import { updateAdminFlag } from '@/actions/flags';
import SourcesInput from '@/components/SourcesInput';
import TagInput from '@/components/TagInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, Loader2, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export type AdminFlagRow = {
  id: string;
  name: string;
  image: string;
  tags: string[];
  sources: string[];
  description: string;
};

type FlagEditDrawerProps = {
  flag: AdminFlagRow;
  onClose: () => void;
  onSaved: () => void;
  onDelete: () => void;
};

export function FlagEditDrawer({ flag, onClose, onSaved, onDelete }: FlagEditDrawerProps) {
  const [draft, setDraft] = useState(flag);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setDraft(flag), [flag]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const save = async () => {
    if (!draft.name.trim() || !draft.image.trim()) {
      toast.error('A flag needs a name and an image.');
      return;
    }
    setIsSaving(true);
    const result = await updateAdminFlag(flag.id, draft).catch(() => null);
    setIsSaving(false);
    if (!result) {
      toast.error('Could not save the flag.');
      return;
    }
    toast.success('Flag saved.');
    onSaved();
  };

  return (
    <aside
      aria-label='Edit flag'
      className='fixed z-40 inset-0 sm:inset-auto sm:top-20 sm:right-4 sm:bottom-4 sm:w-[480px] flex flex-col overflow-hidden sm:rounded-2xl border border-white/90 dark:border-white/20 bg-[image:var(--background-image-noise),var(--background-image-glossy-card)] dark:bg-[image:var(--background-image-noise),var(--background-image-glossy-card-dark)] bg-[size:256px,auto] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]'
    >
      <div className='px-6 pt-5 pb-4 flex items-center justify-between gap-3 border-b border-border/70'>
        <p className='text-lg font-bold truncate'>{flag.name}</p>
        <div className='flex items-center gap-3 shrink-0'>
          <Link href={`/flag/${encodeURIComponent(flag.name)}`} target='_blank' aria-label='Open flag page' className='text-foreground/60 hover:text-foreground'>
            <ExternalLink className='size-4' />
          </Link>
          <button type='button' onClick={onClose} aria-label='Close' className='text-foreground/60 hover:text-foreground cursor-pointer'>
            <X className='size-5' />
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto px-6 py-5 space-y-4'>
        <div className='h-40 rounded-xl bg-foreground/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] flex items-center justify-center'>
          {draft.image && (
            <Image src={draft.image} alt={draft.name} width={320} height={200} className='max-h-28 w-auto max-w-[85%] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.18)]' />
          )}
        </div>
        <div className='space-y-1.5'>
          <label htmlFor='admin-flag-name' className='text-sm font-semibold'>
            Name
          </label>
          <Input id='admin-flag-name' value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </div>
        <div className='space-y-1.5'>
          <label htmlFor='admin-flag-image' className='text-sm font-semibold'>
            Image URL
          </label>
          <Input id='admin-flag-image' value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} />
        </div>
        <TagInput tags={draft.tags} onTagsChange={(tags) => setDraft({ ...draft, tags })} placeholder='Enter tags...' />
        <div className='space-y-1.5'>
          <label htmlFor='admin-flag-description' className='text-sm font-semibold'>
            Description
          </label>
          <Textarea
            id='admin-flag-description'
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </div>
        <SourcesInput
          sources={draft.sources}
          onSourcesChange={(sources) => setDraft({ ...draft, sources })}
          placeholder='Enter URL (must start with http:// or https://)...'
          label='Sources'
        />
      </div>

      <div className='px-6 py-4 border-t border-border/70 flex items-center gap-3'>
        <Button variant='neutral' size='sm' onClick={onDelete} className='text-red-600'>
          <Trash2 />
          Delete
        </Button>
        <div className='flex-1' />
        <Button variant='neutral' size='sm' onClick={onClose}>
          Cancel
        </Button>
        <Button size='sm' onClick={save} disabled={isSaving}>
          {isSaving && <Loader2 className='animate-spin' />}
          Save
        </Button>
      </div>
    </aside>
  );
}
