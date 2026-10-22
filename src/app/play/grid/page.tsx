import type { Metadata } from 'next';
import Vexigrid from '@/components/games/Vexigrid';

export const metadata: Metadata = {
  title: 'Vexigrid - Vexilo',
  description: 'A daily flag grid: fill each square with a country whose flag fits its row and column.',
};

export default function GridPage() {
  return (
    <div className='px-4 md:px-8'>
      <Vexigrid />
    </div>
  );
}
