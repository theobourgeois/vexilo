'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Edit } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { toastErrorWithLogin } from '@/lib/toast-auth';

/** Opens the edit form, the same way "Suggest edit" does, so visitors who aren't signed in are asked to first. */
export default function AddHistoryButton({ flagName }: { flagName: string }) {
  const session = useSession();
  const router = useRouter();
  return (
    <Button
      variant='neutral'
      onClick={() => {
        if (!session.data?.user) {
          toastErrorWithLogin('You must be logged in to edit a flag');
          return;
        }
        router.push(`/flag/${encodeURIComponent(flagName)}?mode=edit`);
      }}
    >
      <Edit />
      Add history
    </Button>
  );
}
