import * as React from "react"
import { Field } from "@base-ui/react/field"

import { cn } from "@/lib/utils"

interface TextareaProps extends Omit<React.ComponentProps<"textarea">, "onChange"> {
  onValueChange?: (value: string, eventDetails: Field.Control.ChangeEventDetails) => void
}

// Field.Control has no dedicated multi-line variant — its own prop types
// are pinned to <input> even though `render` can swap the rendered element,
// the documented Base UI pattern for using any other control element with
// Field (see FieldControl's own doc comment). The cast below is what lets a
// <textarea>-only attribute like `rows` reach the actual DOM node through
// `render` without fighting Field.Control's <input>-shaped prop types.
function Textarea({ className, rows = 5, ...props }: TextareaProps) {
  return (
    <Field.Control
      render={<textarea rows={rows} />}
      data-slot="textarea"
      className={cn(
        "border-input bg-background dark:bg-input/30 min-h-24 w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...(props as Field.Control.Props)}
    />
  )
}

export { Textarea }
