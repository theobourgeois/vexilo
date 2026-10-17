import Link from 'next/link';

const LINKS = [
  { href: 'https://buymeacoffee.com/theobourgeois', label: 'Donate', external: true },
  { href: '/community-guidelines', label: 'Guidelines' },
  { href: '/privacy-policy', label: 'Privacy' },
  { href: '/terms-of-service', label: 'Terms' },
  { href: 'mailto:theoobourgeois@gmail.com', label: 'Contact', external: true },
];

export function Footer() {
  return (
    <footer className='mt-18 border-t border-line'>
      <div className='mx-auto flex max-w-[1312px] flex-col gap-3 px-4 py-6 text-[13px] text-muted-foreground sm:h-[72px] sm:flex-row sm:items-center sm:gap-5 sm:py-0 md:px-8'>
        <span>© {new Date().getFullYear()} Vexilo</span>
        <span className='hidden sm:inline'>A community flag encyclopedia</span>
        <nav className='flex flex-wrap gap-x-5 gap-y-2 sm:ml-auto'>
          {LINKS.map(({ href, label, external }) =>
            external ? (
              <a key={href} href={href} target='_blank' rel='noopener noreferrer' className='transition-colors hover:text-foreground'>
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className='transition-colors hover:text-foreground'>
                {label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
