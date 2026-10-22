import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import { SiteHeader } from '@/components/site-header';
import { Footer } from '@/components/footer';
import { Analytics } from '@vercel/analytics/next';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const keywords = [
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
  // No site-wide canonical: pages inherit it, which told search engines every page was the home page.
  metadataBase: new URL('https://vexilo.org'),
  category: 'education',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased`}>
        <Toaster />
        <Analytics />
        <Providers>
          <SiteHeader />
          <main className='min-h-[calc(100dvh-4rem)]'>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
