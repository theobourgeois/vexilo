import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold ring-offset-background gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'text-main-foreground bg-[image:var(--background-image-noise),var(--background-image-glossy-main)] bg-[size:256px,auto] border border-[oklch(35%_0.15_259)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.85),inset_0_4px_8px_rgba(255,255,255,0.8),inset_0_-4px_8px_rgba(0,0,0,0.5),0_4px_0_oklch(30%_0.1_259),0_12px_20px_oklch(0%_0_0/0.25),0_2px_0_1px_oklch(72%_0.12_250/0.45)] hover:brightness-110 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_4px_8px_rgba(255,255,255,0.85),inset_0_-4px_8px_rgba(0,0,0,0.52),0_4px_0_oklch(30%_0.1_259),0_14px_22px_oklch(0%_0_0/0.3),0_2px_0_1px_oklch(72%_0.12_250/0.5)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_0_0_oklch(30%_0.1_259)] active:translate-y-[4px]',
        noShadow:
          'text-main-foreground bg-[image:var(--background-image-noise),var(--background-image-glossy-main)] bg-[size:256px,auto] border border-[oklch(35%_0.15_259)]',
        neutral:
          'bg-[image:var(--background-image-noise),var(--background-image-glossy-neutral)] bg-[size:256px,auto] dark:bg-[image:var(--background-image-noise),var(--background-image-glossy-neutral-dark)] text-foreground border border-[oklch(72%_0.01_255)] dark:border-black shadow-[inset_0_1px_1px_rgba(255,255,255,1),inset_0_4px_8px_rgba(255,255,255,0.9),inset_0_-4px_8px_rgba(0,0,0,0.12),0_4px_0_oklch(60%_0.01_260),0_12px_20px_oklch(0%_0_0/0.15),0_2px_0_1px_oklch(100%_0_0/0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_4px_8px_rgba(255,255,255,0.1),inset_0_-4px_8px_rgba(0,0,0,0.4),0_4px_0_oklch(15%_0.004_255),0_12px_20px_oklch(0%_0_0/0.4),0_2px_0_1px_rgba(255,255,255,0.15)] hover:brightness-105 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,1),inset_0_4px_8px_rgba(255,255,255,0.95),inset_0_-4px_8px_rgba(0,0,0,0.14),0_4px_0_oklch(60%_0.01_260),0_14px_22px_oklch(0%_0_0/0.2),0_2px_0_1px_oklch(100%_0_0/0.75)] dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),inset_0_4px_8px_rgba(255,255,255,0.12),inset_0_-4px_8px_rgba(0,0,0,0.42),0_4px_0_oklch(15%_0.004_255),0_14px_22px_oklch(0%_0_0/0.45),0_2px_0_1px_rgba(255,255,255,0.18)] active:shadow-[inset_0_3px_5px_rgba(0,0,0,0.15),0_0_0_oklch(60%_0.01_260)] dark:active:shadow-[inset_0_3px_5px_rgba(0,0,0,0.4),0_0_0_oklch(15%_0.004_255)] active:translate-y-[4px]',
        reverse:
          'text-main-foreground bg-[image:var(--background-image-noise),linear-gradient(to_top,oklch(75%_0.15_259)_0%,oklch(65%_0.15_259)_45%,oklch(50%_0.15_259)_50%,oklch(45%_0.15_259)_100%)] bg-[size:256px,auto] border border-[oklch(35%_0.15_259)] shadow-[inset_0_-1px_1px_rgba(255,255,255,0.8),inset_0_-4px_8px_rgba(255,255,255,0.4),inset_0_4px_8px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-[2px]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
