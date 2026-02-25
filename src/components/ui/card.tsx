import * as React from 'react';

import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card'
      className={cn(
        'relative overflow-hidden rounded-2xl flex flex-col shadow-[inset_0_2px_4px_rgba(255,255,255,1),inset_0_6px_16px_rgba(255,255,255,0.8),inset_0_-6px_14px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,1),0_8px_0_-1px_oklch(80%_0.012_258),0_10px_0_-1px_oklch(75%_0.015_260),0_24px_40px_-8px_rgba(0,0,0,0.15),0_2px_0_1px_rgba(255,255,255,0.8)] dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_6px_14px_rgba(255,255,255,0.1),inset_0_-6px_14px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.08),0_8px_0_-1px_oklch(12%_0.006_255),0_10px_0_-1px_oklch(8%_0.004_255),0_24px_40px_-8px_rgba(0,0,0,0.6),0_2px_0_1px_rgba(255,255,255,0.12)] border border-white/90 dark:border-white/20 bg-[image:var(--background-image-noise),var(--background-image-glossy-card)] dark:bg-[image:var(--background-image-noise),var(--background-image-glossy-card-dark)] bg-[size:256px,auto] text-foreground font-base py-6 gap-6 before:pointer-events-none before:absolute before:inset-x-2 before:top-0 before:h-32 before:rounded-b-[2.5rem] before:bg-[linear-gradient(to_bottom,rgba(255,255,255,1)_0%,rgba(255,255,255,0.5)_25%,rgba(255,255,255,0)_100%)] dark:before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0.1)_25%,rgba(255,255,255,0)_100%)] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-[linear-gradient(to_top,rgba(0,0,0,0.05),rgba(0,0,0,0))] dark:after:bg-[linear-gradient(to_top,rgba(0,0,0,0.2),rgba(0,0,0,0))]',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-header'
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-[data-slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-title'
      className={cn('font-heading leading-none', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-description'
      className={cn('text-sm font-base', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-action'
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-content'
      className={cn('px-6', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-footer'
      className={cn('flex items-center px-6 [.border-t]:pt-6', className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
};
