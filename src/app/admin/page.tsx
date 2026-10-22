'use client';

import { getAdminCounts } from '@/actions/flags';
import { AllFlags } from '@/components/admin/AllFlags';
import { BrokenImages } from '@/components/admin/BrokenImages';
import { ContestsAdmin } from '@/components/admin/ContestsAdmin';
import { CreateFlags } from '@/components/admin/CreateFlags';
import { CreatorsAdmin } from '@/components/admin/CreatorsAdmin';
import { MiscTools } from '@/components/admin/MiscTools';
import { ReviewQueue } from '@/components/admin/ReviewQueue';
import { Reports } from '@/components/Reports';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from '@/components/icons';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const VIEWS = ['queue', 'reports', 'flags', 'broken', 'creators', 'contests', 'create', 'tools'] as const;
type AdminView = (typeof VIEWS)[number];

type NavItem = {
  view: AdminView;
  label: string;
  count?: number;
};

function ReportsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Number(searchParams.get('page')) || 1;
  const goTo = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(nextPage));
    router.push(`/admin?${params}`);
  };

  return (
    <div className='space-y-4'>
      <Reports page={page} />
      <div className='flex items-center gap-4'>
        <Button variant='neutral' onClick={() => goTo(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <span className='tabular-nums text-[13px] text-muted-foreground'>Page {page}</span>
        <Button variant='neutral' onClick={() => goTo(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function AdminContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAdmin = session?.user?.isAdmin;
  const requestedView = searchParams.get('view') as AdminView | null;
  const view: AdminView = requestedView && VIEWS.includes(requestedView) ? requestedView : 'queue';

  const { data: counts } = useQuery({
    queryKey: ['adminCounts'],
    queryFn: () => getAdminCounts(),
    enabled: Boolean(isAdmin),
    refetchInterval: 60_000,
  });

  if (status === 'loading') {
    return (
      <div className='flex justify-center py-24'>
        <Loader2 className='size-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (!isAdmin) {
    return <div className='mx-auto max-w-[1312px] px-4 md:px-8 pt-7 pb-12 text-subtle'>Unauthorized</div>;
  }

  const sections: Array<{ title: string; items: NavItem[] }> = [
    {
      title: 'Inbox',
      items: [
        { view: 'queue', label: 'Review queue', count: counts?.pending },
        { view: 'reports', label: 'Reports', count: counts?.reports },
      ],
    },
    {
      title: 'Library',
      items: [
        { view: 'flags', label: 'All flags', count: counts?.flags },
        { view: 'broken', label: 'Broken images', count: counts?.brokenImages },
        { view: 'creators', label: 'Creators' },
      ],
    },
    {
      title: 'Events',
      items: [{ view: 'contests', label: 'Design contests' }],
    },
    {
      title: 'Tools',
      items: [
        { view: 'create', label: 'Create flags' },
        { view: 'tools', label: 'Import & flag of the day' },
      ],
    },
  ];

  const navigate = (nextView: AdminView) => router.push(nextView === 'queue' ? '/admin' : `/admin?view=${nextView}`);

  return (
    <div className='mx-auto max-w-[1312px] px-4 md:px-8 pt-7 pb-10 flex flex-col md:flex-row gap-6 md:gap-8'>
      <aside className='md:w-52 shrink-0'>
        <nav className='flex md:flex-col gap-1 md:gap-6 overflow-x-auto md:sticky md:top-24'>
          {sections.map((section) => (
            <div key={section.title} className='flex md:flex-col gap-1'>
              <p className='hidden md:block vx-label px-3 mb-1.5'>
                {section.title}
              </p>
              {section.items.map(({ view: itemView, label, count }) => (
                <button
                  key={itemView}
                  type='button'
                  onClick={() => navigate(itemView)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 h-9 rounded-[9px] text-sm font-medium whitespace-nowrap cursor-pointer transition-colors',
                    view === itemView
                      ? 'vx-key text-foreground'
                      : 'text-subtle hover:text-foreground hover:bg-foreground/[0.06]',
                  )}
                >
                  {label}
                  {count !== undefined && count > 0 && (
                    <span className='ml-auto pl-2 tabular-nums text-xs text-muted-foreground'>{count.toLocaleString()}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className='flex-1 min-w-0'>
        {view === 'queue' && <ReviewQueue />}
        {view === 'reports' && <ReportsView />}
        {view === 'flags' && <AllFlags />}
        {view === 'broken' && <BrokenImages />}
        {view === 'creators' && <CreatorsAdmin />}
        {view === 'contests' && <ContestsAdmin />}
        {view === 'create' && <CreateFlags />}
        {view === 'tools' && <MiscTools />}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className='mx-auto max-w-[1312px] px-4 md:px-8 pt-7 text-muted-foreground'>Loading...</div>}>
      <AdminContent />
    </Suspense>
  );
}
