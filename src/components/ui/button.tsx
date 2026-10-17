import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-[box-shadow,color,background-color,filter] duration-150 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'text-main-foreground bg-primary hover:brightness-110 active:brightness-95',
        neutral:
          'text-foreground vx-key hover:bg-foreground/[0.04] active:shadow-key-press',
        ghost:
          'text-subtle hover:text-foreground hover:bg-foreground/[0.06]',
        danger:
          'text-white bg-bad hover:brightness-110 active:brightness-95',
        noShadow: 'text-main-foreground bg-primary',
        reverse: 'text-foreground vx-well',
      },
      size: {
        default: 'h-[38px] px-3.5',
        sm: 'h-8 px-3 text-[13px] rounded-[9px]',
        lg: 'h-11 px-5',
        icon: 'size-[38px]',
        'icon-sm': 'size-8 rounded-[9px]',
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
