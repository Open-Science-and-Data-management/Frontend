import React from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { userFullName, userInitials } from "@/schemas/user";
import { useProjectStore } from "@/store/projectStore";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  useAuthStore,
} from "@/store/authStore";
import { cn } from "@/utils/cn";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const users = useProjectStore((s) => s.users);
  const login = useAuthStore((s) => s.login);
  const [selected, setSelected] = React.useState<string | undefined>(
    users[0]?.user_id,
  );

  // Back to wherever the guard turned them away from.
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/";

  const selectedUser = users.find((u) => u.user_id === selected);

  const handleContinue = () => {
    if (!selected) return;
    login(selected);
    navigate(from === "/login" ? "/" : from, { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>Sign in | DMP-Researcher</title>
      </Helmet>

      <div className="flex min-h-dvh flex-col bg-background">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <span className="text-xl font-bold">Logo</span>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                Sign in to DMP-Researcher
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Demo mode — choose an account to continue. No password needed.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Demo accounts"
              className="space-y-3"
            >
              {users.map((user) => {
                const isSelected = user.user_id === selected;
                return (
                  <button
                    key={user.user_id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelected(user.user_id)}
                    onDoubleClick={handleContinue}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary ring-1 ring-primary"
                        : "hover:border-primary/50",
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {userInitials(user)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {userFullName(user)}
                        </span>
                        <Chip
                          variant={
                            user.role === "researcher" ? "neutral" : "ai"
                          }
                        >
                          {ROLE_LABELS[user.role]}
                        </Chip>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[user.role]}
                      </span>
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!selectedUser}
              onClick={handleContinue}
            >
              {selectedUser
                ? `Continue as ${ROLE_LABELS[selectedUser.role].toLowerCase()}`
                : "Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              You can switch accounts any time from the menu in the top right.
            </p>
          </div>
        </main>
      </div>
    </>
  );
};
