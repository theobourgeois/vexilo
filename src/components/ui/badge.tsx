import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import * as React from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-[image:var(--background-image-noise),var(--background-image-glossy-main)] bg-[size:256px,auto] text-main-foreground border border-[oklch(45%_0.15_259)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_2px_4px_rgba(255,255,255,0.4),0_2px_0_oklch(40%_0.15_259),0_4px_6px_rgba(0,0,0,0.2)]",
        neutral: "bg-[image:var(--background-image-noise),var(--background-image-glossy-neutral)] bg-[size:256px,auto] dark:bg-[image:var(--background-image-noise),var(--background-image-glossy-neutral-dark)] text-foreground border border-[oklch(80%_0.01_255)] dark:border-black shadow-[inset_0_1px_1px_rgba(255,255,255,1),inset_0_2px_4px_rgba(255,255,255,0.6),0_2px_0_oklch(80%_0.01_255),0_4px_6px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_2px_4px_rgba(255,255,255,0.1),0_2px_0_rgba(0,0,0,0.8),0_4px_6px_rgba(0,0,0,0.4)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
