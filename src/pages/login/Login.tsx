import React from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AuthField,
  AuthLayout,
  PasswordInput,
} from "@/components/auth/AuthLayout";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  ROLE_LABELS,
  useAuthStore,
} from "@/store/authStore";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((s) => s.signIn);

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [submitting, setSubmitting] = React.useState(false);

  // Back to wherever the guard turned them away from.
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setSubmitting(true);
    const result = await signIn(username, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      setPassword("");
      return;
    }
    navigate(["/login", "/register"].includes(from) ? "/" : from, {
      replace: true,
    });
  };

  return (
    <>
      <Helmet>
        <title>Sign in | DMP-Researcher</title>
      </Helmet>

      <AuthLayout>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back to DMP-Researcher.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-lg border bg-card p-6"
        >
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <AuthField id="login-username" label="Username">
            {(field) => (
              <Input
                {...field}
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(undefined);
                }}
              />
            )}
          </AuthField>

          <AuthField id="login-password" label="Password">
            {(field) => (
              <PasswordInput
                {...field}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(undefined);
                }}
              />
            )}
          </AuthField>

          <Button type="submit" className="w-full" isLoading={submitting}>
            {!submitting && <LogIn className="mr-2 h-4 w-4" />}
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>

        {/* Prototype only: lets a reviewer try both sides without signing up. */}
        <div className="rounded-lg border border-dashed p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Demo accounts · password “{DEMO_PASSWORD}”
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.username}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setUsername(account.username);
                  setPassword(DEMO_PASSWORD);
                  setError(undefined);
                }}
              >
                {account.username} · {ROLE_LABELS[account.role]}
              </Button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs">
          <Link
            to="/"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            New here? See how DMP-Researcher works
          </Link>
        </p>
      </AuthLayout>
    </>
  );
};
