'use client';

import { getAdminUsers, setUserTrusted } from '@/actions/admin-users';
import { approvePendingFlagRequestsForUser } from '@/actions/requests';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useTrustCreator() {
  const queryClient = useQueryClient();

  const approvePending = async (userId: string, name: string) => {
    toast.loading(`Approving ${name}'s pending requests...`);
    const result = await approvePendingFlagRequestsForUser(userId);
    toast.dismiss();
    if (!result) {
      toast.error('Unauthorized');
      return;
    }
    toast.success(`Approved ${result.approved} of ${result.total} pending requests from ${name}.`);
    queryClient.invalidateQueries({ queryKey: ['flagRequests'] });
    queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
  };

  const setTrusted = async (
    /** pending is null when the exact count isn't known. */
    user: { id: string; name: string | null; pending: number | null },
    isTrusted: boolean,
  ) => {
    const name = user.name || 'This creator';
    const result = await setUserTrusted(user.id, isTrusted);
    if (!result) {
      toast.error('Could not update creator.');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    queryClient.invalidateQueries({ queryKey: ['flagRequests'] });

    if (!isTrusted) {
      toast.success(`${name} is no longer trusted.`);
      return;
    }

    toast.success(`${name} is now trusted. New flags and edits go live automatically.`, {
      action:
        user.pending !== 0
          ? {
              label:
                user.pending === null
                  ? 'Approve their pending requests'
                  : `Approve ${user.pending} pending`,
              onClick: () => approvePending(user.id, name),
            }
          : undefined,
      duration: user.pending !== 0 ? 10000 : undefined,
    });
  };

  return { setTrusted, approvePending };
}

export function CreatorsAdmin() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const { setTrusted, approvePending } = useTrustCreator();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', debouncedSearch, page],
    queryFn: () => getAdminUsers(debouncedSearch, page),
  });

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-bold'>Creators</h2>
          <p className='text-sm text-foreground/60'>
            Trusted creators skip review: their new flags and edits are approved automatically.
          </p>
        </div>
        <div className='relative sm:w-80'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 size-4 text-foreground/50' />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search name or email...'
            className='pl-10'
          />
        </div>
      </div>

      <Card className='py-2 gap-0'>
        <CardContent className='px-2'>
          {isLoading && <p className='p-4 text-sm text-foreground/60'>Loading...</p>}
          {data?.users.length === 0 && (
            <p className='p-4 text-sm text-foreground/60'>No creators found.</p>
          )}
          <ul className='divide-y divide-border/60'>
            {data?.users.map((user) => (
              <li key={user.id} className='flex items-center gap-3 px-3 py-3'>
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt='' className='size-9 rounded-full shrink-0' />
                ) : (
                  <div className='size-9 rounded-full bg-foreground/10 shrink-0' />
                )}
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <Link
                      href={`/profile/${user.userNumber}`}
                      target='_blank'
                      className='font-semibold hover:underline truncate'
                    >
                      {user.name || 'Unnamed'}
                    </Link>
                    {user.isAdmin && <Badge variant='neutral'>Admin</Badge>}
                    {user.isTrusted && (
                      <Badge className='gap-1'>
                        <ShieldCheck className='size-3' />
                        Trusted
                      </Badge>
                    )}
                  </div>
                  <p className='text-xs text-foreground/60 truncate'>
                    {user.email} · {user.contributions} contribution
                    {user.contributions === 1 ? '' : 's'}
                    {user.pending > 0 && ` · ${user.pending} pending`}
                  </p>
                </div>
                {user.isTrusted && user.pending > 0 && (
                  <Button
                    size='sm'
                    variant='neutral'
                    onClick={() => approvePending(user.id, user.name || 'This creator')}
                  >
                    Approve {user.pending} pending
                  </Button>
                )}
                <label className='flex items-center gap-2 text-sm font-semibold shrink-0 cursor-pointer'>
                  <span className='hidden sm:inline'>Trusted</span>
                  <Switch
                    checked={user.isTrusted}
                    onCheckedChange={(checked) => setTrusted(user, checked)}
                    aria-label={`Trust ${user.name || 'creator'}`}
                  />
                </label>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className='flex items-center gap-4'>
        <Button variant='neutral' onClick={() => setPage(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <span className='text-sm text-foreground/60'>
          Page {page} of {totalPages}
        </span>
        <Button
          variant='neutral'
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
