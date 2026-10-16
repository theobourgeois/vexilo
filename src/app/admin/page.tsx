'use client';

import { getAdminCounts } from '@/actions/flags';
import { AllFlags } from '@/components/admin/AllFlags';
import { CreatorsAdmin } from '@/components/admin/CreatorsAdmin';
import { MiscTools } from '@/components/admin/MiscTools';
import { ReviewQueue } from '@/components/admin/ReviewQueue';
import { Reports } from '@/components/Reports';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
  FlagTriangleRight,
  Inbox,
  LayoutGrid,
  Loader2,
  Users,
  Wrench,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const VIEWS = ['queue', 'reports', 'flags', 'creators', 'tools'] as const;
type AdminView = (typeof VIEWS)[number];

type NavItem = {
  view: AdminView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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
        <span className='text-sm text-foreground/60'>Page {page}</span>
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
        <Loader2 className='size-8 animate-spin text-foreground/40' />
      </div>
    );
  }

  if (!isAdmin) {
    return <div className='max-w-7xl mx-auto px-4 py-12'>Unauthorized</div>;
  }

  const sections: Array<{ title: string; items: NavItem[] }> = [
    {
      title: 'Inbox',
      items: [
        { view: 'queue', label: 'Review queue', icon: Inbox, count: counts?.pending },
        { view: 'reports', label: 'Reports', icon: FlagTriangleRight, count: counts?.reports },
      ],
    },
    {
      title: 'Library',
      items: [
        { view: 'flags', label: 'All flags', icon: LayoutGrid, count: counts?.flags },
        { view: 'creators', label: 'Creators', icon: Users },
      ],
    },
    {
      title: 'Tools',
      items: [{ view: 'tools', label: 'Import & flag of the day', icon: Wrench }],
    },
  ];

  const navigate = (nextView: AdminView) => router.push(nextView === 'queue' ? '/admin' : `/admin?view=${nextView}`);

  return (
    <div className='max-w-[1400px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row gap-6 md:gap-8 py-6'>
      <aside className='md:w-56 shrink-0'>
        <nav className='flex md:flex-col gap-1 md:gap-6 overflow-x-auto md:sticky md:top-6'>
          {sections.map((section) => (
            <div key={section.title} className='flex md:flex-col gap-1'>
              <p className='hidden md:block text-[11px] font-bold uppercase tracking-wider text-foreground/50 px-3 mb-1'>
                {section.title}
              </p>
              {section.items.map(({ view: itemView, label, icon: Icon, count }) => (
                <button
                  key={itemView}
                  type='button'
                  onClick={() => navigate(itemView)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors',
                    view === itemView
                      ? 'bg-secondary-background text-foreground shadow-sm ring-1 ring-border'
                      : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5',
                  )}
                >
                  <Icon className='size-4' />
                  {label}
                  {count !== undefined && count > 0 && (
                    <span className='ml-auto pl-2 text-xs font-bold text-foreground/50'>{count.toLocaleString()}</span>
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
        {view === 'creators' && <CreatorsAdmin />}
        {view === 'tools' && <MiscTools />}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminContent />
    </Suspense>
  );
}
