import type { Metadata } from 'next';
import FlagQuiz from '@/components/FlagQuiz';

export const metadata: Metadata = { title: 'Flag quiz - Vexilo' };

export default function QuizPage() {
  return (
    <div className='px-4 md:px-8'>
      <FlagQuiz />
    </div>
  );
}
