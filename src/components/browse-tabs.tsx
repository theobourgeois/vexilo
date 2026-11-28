import Link from 'next/link';
import { Layers, SquaresFour } from '@/components/icons';
import { cn } from '@/lib/utils';

/** "All flags | Collections": the two ways into the real flags, shown on /browse and /flags. */
export default function BrowseTabs({ active, className }: { active: 'all' | 'collections'; className?: string }) {
  const tabs = [
    { key: 'all', href: '/browse', label: 'All flags', icon: <SquaresFour /> },
    { key: 'collections', href: '/flags', label: 'Collections', icon: <Layers /> },
  ] as const;
  return (
    <nav aria-label='Browse' className={cn('vx-well inline-flex gap-0.5 rounded-[11px] p-[3px]', className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={cn(
            'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium text-subtle outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5',
            tab.key === active && 'vx-key text-foreground',
          )}
        >
          {tab.icon}
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
