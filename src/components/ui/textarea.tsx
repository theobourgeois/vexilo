import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-[88px] py-2.5 flex w-full rounded-[11px] vx-well bg-well px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-shadow focus-visible:shadow-[var(--sh-well),0_0_0_2px_var(--main)] disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
