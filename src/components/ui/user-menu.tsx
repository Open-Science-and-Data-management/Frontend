import React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { userFullName, userInitials } from "@/schemas/user";
import {
  ACCOUNT_TYPE_LABELS,
  ROLE_LABELS,
  useAuthStore,
  useCurrentUser,
} from "@/store/authStore";
import { cn } from "@/utils/cn";

/**
 * Who is signed in, and the way out. Becoming someone else means signing out
 * and back in with their password — there is no shortcut around it.
 */
export const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = React.useState(false);

  if (!user) return null;

  const signOut = () => {
    setOpen(false);
    logout();
    // Back to the front door, which is the landing page when signed out.
    navigate("/", { replace: true });
  };

  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`Account: ${userFullName(user)}, ${ROLE_LABELS[user.role]}`}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {userInitials(user)}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-[10rem] truncate text-sm font-medium">
              {userFullName(user)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {ROLE_LABELS[user.role]}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 w-72 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="space-y-1.5 px-2 py-1.5">
            <div>
              <p className="truncate text-sm font-medium">
                {userFullName(user)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.username ? `@${user.username} · ` : ""}
                {user.email}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Chip variant={user.role === "researcher" ? "neutral" : "ai"}>
                {ROLE_LABELS[user.role]}
              </Chip>
              {user.account_type && (
                <Chip variant="outline">
                  {ACCOUNT_TYPE_LABELS[user.account_type]}
                </Chip>
              )}
            </div>
            {user.affiliation && (
              <p className="truncate text-xs text-muted-foreground">
                {user.affiliation.organization}
              </p>
            )}
          </div>

          <div className="mt-1 border-t pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/settings");
              }}
              className={itemClass}
            >
              <SettingsIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              Profile &amp; settings
            </button>
            <button type="button" onClick={signOut} className={itemClass}>
              <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" />
              Sign out
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
