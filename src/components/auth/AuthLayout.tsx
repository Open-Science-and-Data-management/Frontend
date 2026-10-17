import React from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/utils/cn";

/** The frame around Sign in and Sign up: no app shell before you're in. */
export const AuthLayout: React.FC<{
  /** Card width; sign-up needs more room than sign-in. */
  width?: "sm" | "lg";
  children: React.ReactNode;
}> = ({ width = "sm", children }) => (
  <div className="flex min-h-dvh flex-col bg-background">
    <header className="flex h-16 items-center justify-between border-b px-6">
      <Link to="/" className="text-xl font-bold">
        Logo
      </Link>
      <ThemeToggle />
    </header>
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
      <div
        className={cn(
          "w-full space-y-6",
          width === "lg" ? "max-w-2xl" : "max-w-md",
        )}
      >
        {children}
      </div>
    </main>
  </div>
);

/** A labelled input with its hint or error underneath, wired for screen readers. */
export const AuthField: React.FC<{
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}> = ({ id, label, error, hint, optional, className, children }) => {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

/** A password box with a show/hide toggle. */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
