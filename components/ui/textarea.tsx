import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-offset-white transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
