const bar = 'animate-pulse rounded bg-foreground/[0.06]';

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <section className='vx-tile px-[22px] py-5'>
      <div className={`mb-5 h-3.5 w-20 ${bar}`} />
      <div className='space-y-0'>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className='flex items-center justify-between border-b border-dashed border-border py-[11px] last:border-0'
          >
            <div className={`h-3 w-20 ${bar}`} />
            <div className={`h-3 w-14 ${bar}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FlagLoading() {
  return (
    <div className='mx-auto max-w-[1312px] px-4 md:px-8' aria-busy='true' aria-label='Loading flag'>
      <div className='flex items-center gap-2 pb-4 pt-[22px]'>
        <div className={`h-3.5 w-12 ${bar}`} />
        <div className={`h-3.5 w-16 ${bar}`} />
        <div className={`h-3.5 w-24 ${bar}`} />
      </div>

      <div className='grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10'>
        <div className='vx-tile flex flex-col overflow-hidden'>
          <div className='bg-stage relative h-[340px] sm:h-[440px]'>
            <div className='absolute right-3.5 top-3.5 h-9 w-[168px] animate-pulse rounded-full bg-foreground/[0.06]' />
            <div className='absolute bottom-10 left-8 top-16 w-1.5 animate-pulse rounded-full bg-foreground/[0.08] sm:left-[72px] sm:top-14' />
            <div className='absolute left-[46px] top-[76px] h-[180px] w-[min(60%,380px)] animate-pulse rounded bg-foreground/[0.06] sm:left-[86px] sm:top-[66px] sm:h-[230px]' />
          </div>
          <div className='flex items-center gap-2 border-t border-line py-3 pl-[18px] pr-3'>
            <div className={`h-3 w-8 ${bar}`} />
            <span className='flex-1' />
            <div className={`h-8 w-24 rounded-[10px] ${bar}`} />
            <div className={`h-8 w-24 rounded-[10px] ${bar}`} />
          </div>
        </div>

        <section className='flex flex-col lg:pt-1'>
          <div className={`h-3 w-28 ${bar}`} />
          <div className={`mt-3.5 h-9 w-3/4 sm:h-10 ${bar}`} />
          <div className='mt-5 space-y-2.5'>
            <div className={`h-3.5 w-full ${bar}`} />
            <div className={`h-3.5 w-full ${bar}`} />
            <div className={`h-3.5 w-2/3 ${bar}`} />
          </div>
          <div className='mt-6 flex gap-2'>
            <div className={`h-10 w-28 rounded-[11px] ${bar}`} />
            <div className={`h-10 w-24 rounded-[11px] ${bar}`} />
            <div className={`h-10 w-10 rounded-[11px] ${bar}`} />
          </div>
          <div className='mt-5 flex flex-wrap gap-1.5 border-t border-line pt-5'>
            {[64, 88, 56, 72, 96].map((w, i) => (
              <div key={i} className='h-[26px] animate-pulse rounded-full bg-foreground/[0.06]' style={{ width: w }} />
            ))}
          </div>
        </section>
      </div>

      <div className='mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={5} />
      </div>

      <div className='mt-10'>
        <div className={`mb-4 h-4 w-32 ${bar}`} />
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className='vx-tile h-[292px] animate-pulse' />
          ))}
        </div>
      </div>
    </div>
  );
}
