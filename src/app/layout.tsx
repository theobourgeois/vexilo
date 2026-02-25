import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import Logo from '@/components/Logo';
import { AuthHeader } from '@/components/auth-header';
import { Toaster } from '@/components/ui/sonner';
import { PostFlagButton } from '@/components/post-flag-button';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { Footer } from '@/components/footer';
import { Analytics } from '@vercel/analytics/next';
import { Heart, Gamepad2 } from 'lucide-react';
import Link from 'next/link';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const keywords = [
  'flags',
  'world flags',
  'country flags',
  'flag database',
  'flag search',
  'flag collection',
  'national flags',
  'Vexilo',
  'discover flags',
  'flag quiz',
  'flag of the day',
  'flag community',
  'flag enthusiasts',
  'learn flags',
  'flag trivia',
  'geography',
  'international flags',
  'flag history',
  'flag meanings',
  'flag symbols',
  'flag identification',
];

export const metadata: Metadata = {
  title: 'Vexilo - Discover Flags from Around the World',
  description:
    "Explore, discover, and learn about flags from around the world with Vexilo. Join a community of flag enthusiasts, take quizzes, and contribute to the world's most engaging flag database.",
  keywords,
  authors: [{ name: 'Théo Bourgeois' }, { name: 'Vexilo Community' }],
  generator: 'Next.js',
  applicationName: 'Vexilo - World Flag Discovery Platform',
  referrer: 'origin-when-cross-origin',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://vexilo.org',
    title: 'Vexilo - Discover Flags from Around the World',
    description:
      "Explore, discover, and learn about flags from around the world with Vexilo. Join a community of flag enthusiasts, take quizzes, and contribute to the world's most engaging flag database.",
    siteName: 'Vexilo',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Vexilo - Discover Flags from Around the World',
      },
    ],
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        url: '/logo.png',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // verification: {
  //     google: process.env.GOOGLE_VERIFICATION,
  // },
  alternates: {
    canonical: 'https://vexilo.org',
  },
  category: 'education',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${dmSans.variable} antialiased bg-[image:var(--background-image-noise),radial-gradient(ellipse_at_top,oklch(96%_0.01_255),oklch(92%_0.02_255))] dark:bg-[image:var(--background-image-noise),radial-gradient(ellipse_at_top,oklch(22%_0.01_255),oklch(15%_0.01_255))] bg-[size:256px,auto]`}>
        <Toaster />
        <Analytics />
        <Providers>
          {/* Logo Header */}
          <header className='max-w-7xl mx-auto px-4 flex flex-col items-start justify-start py-4'>
            <div className='w-full flex justify-between items-start'>
              <div>
                <Logo />
              </div>
              <div className='flex items-center gap-2'>
                <div className='hidden md:flex items-center gap-4'>
                  <Link
                    href='/quiz'
                    className='flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors'
                  >
                    <Gamepad2 className='w-4 h-4' />
                    Quiz
                  </Link>
                  <a
                    href='https://buymeacoffee.com/theobourgeois'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors'
                  >
                    <Heart className='w-4 h-4 fill-red-500 text-red-500 drop-shadow-sm' />
                    Donate
                  </a>
                  <PostFlagButton />
                  <AuthHeader />
                </div>
                <HamburgerMenu />
              </div>
            </div>
          </header>
          <div className='w-full min-h-screen'>
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
