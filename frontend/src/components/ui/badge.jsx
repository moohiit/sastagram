import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-900 text-zinc-900 dark:text-gray-100 hover:bg-slate-900/80",
        secondary:
          "border-transparent bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-gray-100 hover:bg-zinc-300/80 dark:hover:bg-zinc-800/80",
        destructive:
          "border-transparent bg-red-500 text-zinc-900 dark:text-gray-100 hover:bg-red-500/80",
        outline: "text-zinc-900 dark:text-gray-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
