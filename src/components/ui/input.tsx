import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 py-2 flex w-full rounded-[11px] vx-well bg-well px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-shadow focus-visible:shadow-[var(--sh-well),0_0_0_2px_var(--main)] disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
