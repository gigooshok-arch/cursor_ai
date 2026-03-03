"use client";

import * as React from "react";

import { maskPhoneRu } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export interface PhoneInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, defaultValue, onInput, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="tel"
        inputMode="tel"
        defaultValue={typeof defaultValue === "string" ? maskPhoneRu(defaultValue) : defaultValue}
        onInput={(event) => {
          const target = event.currentTarget;
          target.value = maskPhoneRu(target.value);
          onInput?.(event);
        }}
        className={cn(
          "h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-offset-white transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300",
          className,
        )}
        {...props}
      />
    );
  },
);

PhoneInput.displayName = "PhoneInput";
