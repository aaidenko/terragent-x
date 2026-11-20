import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/*
 * Deck buttons: pills only, regular weight, no shadows.
 *  - solid: mist fill, ink text (the one primary action per view)
 *  - glass: frosted pill (over gradients and imagery)
 *  - line:  hairline pill (over flat ink)
 *  - quiet: text-only with a drawn underline
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2.5 overflow-hidden rounded-full font-normal whitespace-nowrap select-none outline-none transition-[background-color,color,border-color,opacity,transform] duration-200 ease-(--ease-deck) disabled:pointer-events-none disabled:opacity-40 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        solid: "bg-mist text-ink hover:bg-paper",
        glass: "glass-pill text-paper hover:bg-white/25",
        line: "border border-hair-strong text-paper hover:border-paper/60 hover:bg-white/[0.04]",
        quiet: "rounded-none px-0! text-paper/80 hover:text-paper",
      },
      size: {
        sm: "h-8 px-3.5 text-micro",
        default: "h-10 px-5 text-micro",
        lg: "h-12 px-6 text-body",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "solid",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
