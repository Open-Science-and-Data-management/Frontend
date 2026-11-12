import React from "react";
import wordmark from "@/assets/Thai-DMP-Logo.png";
import mark from "@/assets/Thai-DMP-Logo-D.png";
import { cn } from "@/utils/cn";

/**
 * The Thai DMP logo. `full` is the wordmark for headers; `mark` is the
 * document symbol alone, for spaces too narrow for the name. Both have
 * transparent backgrounds, so they sit on the light and dark themes alike.
 */
export const Logo: React.FC<{
  variant?: "full" | "mark";
  className?: string;
}> = ({ variant = "full", className }) => (
  <img
    src={variant === "full" ? wordmark : mark}
    alt="Thai DMP"
    className={cn("h-10 w-auto select-none", className)}
    draggable={false}
  />
);
