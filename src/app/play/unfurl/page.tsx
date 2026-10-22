import type { Metadata } from 'next';
import Unfurl from '@/components/games/Unfurl';

export const metadata: Metadata = {
  title: 'Unfurl - Vexilo',
  description: 'A daily flag puzzle: name the country as its flag is revealed a few tiles at a time.',
};

export default function UnfurlPage() {
  return (
    <div className='px-4 md:px-8'>
      <Unfurl />
    </div>
  );
}
