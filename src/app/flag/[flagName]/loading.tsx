const bar = 'animate-pulse rounded bg-foreground/[0.08]';

export default function FlagLoading() {
  return (
    <div aria-busy='true' aria-label='Loading flag'>
      <div className='flag-band'>
        <div className='mx-auto max-w-[1312px] px-4 pb-[84px] md:px-8 lg:pb-[92px]'>
          <div className='flex items-center gap-2 pb-4 pt-[22px]'>
            <div className={`h-3.5 w-12 ${bar}`} />
            <div className={`h-3.5 w-16 ${bar}`} />
            <div className={`h-3.5 w-24 ${bar}`} />
          </div>

          <div className='grid items-center gap-8 pt-2 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-16 lg:pt-3.5'>
            <div>
              <div className='grid h-[230px] place-items-center sm:h-[345px]'>
                <div className={`aspect-[3/2] h-[180px] sm:h-[300px] ${bar}`} />
              </div>
              <div className='mt-4 flex items-center gap-2'>
                <div className={`h-9 w-[150px] rounded-[11px] ${bar}`} />
                <span className='flex-1' />
                <div className={`h-8 w-24 rounded-[9px] ${bar}`} />
                <div className={`size-8 rounded-[9px] ${bar}`} />
              </div>
            </div>

            <section>
              <div className={`h-3 w-28 ${bar}`} />
              <div className={`mt-3.5 h-11 w-3/4 sm:h-[52px] ${bar}`} />
              <div className='mt-5 max-w-[560px] space-y-2.5'>
                <div className={`h-3.5 w-full ${bar}`} />
                <div className={`h-3.5 w-full ${bar}`} />
                <div className={`h-3.5 w-2/3 ${bar}`} />
              </div>
              <div className='mt-6 flex gap-2'>
                <div className={`h-[38px] w-28 rounded-[10px] ${bar}`} />
                <div className={`h-[38px] w-28 rounded-[10px] ${bar}`} />
                <div className={`h-[38px] w-24 rounded-[10px] ${bar}`} />
              </div>
              <div className='mt-5 flex flex-wrap gap-1.5'>
                {[64, 88, 56, 72, 96].map((w, i) => (
                  <div key={i} className='h-[26px] animate-pulse rounded-full bg-foreground/[0.08]' style={{ width: w }} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className='mx-auto max-w-[1312px] px-4 md:px-8'>
        <div className='relative z-10 -mt-11 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line shadow-[var(--sh-tile),0_14px_36px_-18px_rgb(0_0_0/0.3)] lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]'>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`bg-surface px-5 py-4 ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}>
              <div className='h-3 w-16 animate-pulse rounded bg-foreground/[0.06]' />
              <div className='mt-2.5 h-4 w-20 animate-pulse rounded bg-foreground/[0.06]' />
            </div>
          ))}
        </div>

        <div className='mt-14'>
          <div className='mb-4 h-4 w-32 animate-pulse rounded bg-foreground/[0.06]' />
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className='vx-tile h-[292px] animate-pulse' />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
