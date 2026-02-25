import FlagQuiz from '@/components/FlagQuiz';

export default function QuizPage() {
  return (
    <div className='min-h-screen bg-main/10 dark:bg-transparent pt-0'>
      <div className='max-w-3xl mx-auto px-4 py-8'>
        <FlagQuiz />
      </div>
    </div>
  );
}
