import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Текстовая область без авто-роста: фиксируется в пределах контейнера
 * и прокручивается внутри себя. Используем forwardRef для доступа к DOM
 * (нужно для синхронизации прокрутки редактора с превью).
 */
const Textarea = React.forwardRef(function TextareaInternal({
  className,
  ...props
}, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        // Убираем auto-size (field-sizing-content), добавляем overflow-auto и фикс. min-h
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm overflow-auto resize-none",
        className
      )}
      {...props}
    />
  );
});

export { Textarea }
