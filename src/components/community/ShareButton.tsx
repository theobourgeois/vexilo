'use client';

import { toast } from 'sonner';
import { Share } from '@/components/icons';
import { Button } from '@/components/ui/button';

/** The phone's share sheet where there is one, else copies the link. */
export default function ShareButton({ path, title, label }: { path: string; title: string; label?: string }) {
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Closed the sheet: nothing to do.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy the link.');
    }
  }
  return (
    <Button variant='neutral' size={label ? 'default' : 'icon'} onClick={share} title='Share' aria-label='Share'>
      <Share />
      {label}
    </Button>
  );
}
