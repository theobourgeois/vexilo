'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from '@/components/icons';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant='neutral'
      size='icon'
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      title='Toggle theme'
    >
      <Sun className='hidden dark:block' />
      <Moon className='dark:hidden' />
      <span className='sr-only'>Toggle theme</span>
    </Button>
  );
}
