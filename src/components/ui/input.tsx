import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full rounded-2xl border border-[oklch(80%_0.01_255)] dark:border-white/10 bg-[image:var(--background-image-noise),linear-gradient(to_bottom,oklch(96%_0.01_255)_0%,oklch(100%_0_0)_100%)] dark:bg-[image:var(--background-image-noise),linear-gradient(to_bottom,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0.4)_100%)] bg-[size:256px,auto] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_4px_8px_rgba(0,0,0,0.05),0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),inset_0_4px_12px_rgba(0,0,0,0.3),0_1px_1px_rgba(255,255,255,0.1)] selection:bg-main selection:text-main-foreground px-4 py-2 text-base font-medium text-foreground file:border-0 file:bg-transparent file:text-sm file:font-heading placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-main focus-visible:border-main focus-visible:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_0_2px_oklch(60%_0.15_259/0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
