import React from "react";
import { Helmet } from "react-helmet-async";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useTheme } from "@/components/ui/ThemeProvider";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore, useCurrentUser } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { userProfileSchema } from "@/schemas/user";
import { authApi } from "@/api/authApi";
import { ApiError } from "@/api/http";

type ProfileField = "title" | "name" | "surname" | "email";

const PROFILE_FIELDS: { key: ProfileField; label: string; type?: string }[] = [
  { key: "title", label: "Title" },
  { key: "name", label: "Name" },
  { key: "surname", label: "Surname" },
  { key: "email", label: "Email", type: "email" },
];

const ProfileSection: React.FC = () => {
  // Whoever is signed in edits their own profile.
  const user = useCurrentUser();
  const updateUser = useProjectStore((s) => s.updateUser);
  const toast = useToastStore((s) => s.toast);

  const fromUser = () => ({
    title: user?.title ?? "",
    name: user?.name ?? "",
    surname: user?.surname ?? "",
    email: user?.email ?? "",
  });

  const [editing, setEditing] = React.useState(false);
  const [values, setValues] = React.useState(fromUser);
  const [errors, setErrors] = React.useState<
    Partial<Record<ProfileField, string>>
  >({});

  const startEditing = () => {
    setValues(fromUser());
    setErrors({});
    setEditing(true);
  };

  const cancel = () => {
    setErrors({});
    setEditing(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = userProfileSchema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<ProfileField, string>> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as ProfileField;
        next[key] ??= issue.message;
      });
      setErrors(next);
      return;
    }
    if (!user?.user_id) return;
    const patch = { ...result.data, title: result.data.title || undefined };

    // The server checks the email is free and answers with the saved user.
    try {
      const saved = await authApi.updateMe(patch);
      updateUser(user.user_id, saved);
      useAuthStore.getState().setUser(saved);
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_taken")
        setErrors({ email: "Another account already uses this email." });
      else
        toast({
          title: "Profile not saved",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      return;
    }
    setErrors({});
    setEditing(false);
    toast({ title: "Profile saved" });
  };

  if (!user) return null;

  const current = fromUser();

  return (
    <form
      onSubmit={save}
      noValidate
      className="space-y-4 rounded-lg border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold">Profile</h2>
        {!editing && (
          <Button type="button" variant="outline" onClick={startEditing}>
            Edit profile
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PROFILE_FIELDS.map(({ key, label, type }) => (
          <div key={key}>
            {editing ? (
              <>
                <label
                  htmlFor={`settings-${key}`}
                  className="mb-1 block text-sm font-medium"
                >
                  {label}
                </label>
                <Input
                  id={`settings-${key}`}
                  type={type}
                  value={values[key]}
                  aria-invalid={Boolean(errors[key])}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
                {errors[key] && (
                  <p className="mt-1 text-xs text-destructive">{errors[key]}</p>
                )}
              </>
            ) : (
              <>
                <p className="mb-1 text-sm font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">
                  {current[key] || "Not set"}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="flex gap-2">
          <Button type="submit">Save changes</Button>
          <Button type="button" variant="outline" onClick={cancel}>
            Cancel
          </Button>
        </div>
      )}
    </form>
  );
};

export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const user = useCurrentUser();

  return (
    <>
      <Helmet>
        <title>Settings | DMP-Researcher</title>
      </Helmet>

      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

        {/* Keyed so switching accounts never shows the last one's form. */}
        <ProfileSection key={user?.user_id} />

        <section className="space-y-4 rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Appearance</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">
                Choose how DMP-Researcher looks on this device.
              </p>
            </div>
            <Select
              aria-label="Theme"
              className="w-32"
              value={theme}
              onChange={(e) =>
                setTheme(e.target.value as "light" | "dark" | "system")
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </Select>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Notifications</h2>
          {/* The server sends no email yet and stores no preference for it;
              a working switch here would promise something that never comes. */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm">Email me when a committee makes a decision</p>
              <p className="text-xs text-muted-foreground">
                Not available yet. Decisions show up here in Notifications.
              </p>
            </div>
            <Toggle checked={false} disabled aria-label="Email notifications (not available yet)" onCheckedChange={() => {}} />
          </div>
        </section>
      </div>
    </>
  );
};
