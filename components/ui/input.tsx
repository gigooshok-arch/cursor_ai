import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-offset-white transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
