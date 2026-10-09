import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-[#101a2e] border border-[#1b3046]/40 animate-pulse rounded-2xl", className)}
      {...props}
    />
  )
}

export { Skeleton }
