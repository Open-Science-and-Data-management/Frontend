import React from "react";
import { Helmet } from "react-helmet-async";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useTheme } from "@/components/ui/ThemeProvider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { clearPersistedState } from "@/store/persist";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentUser } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { userProfileSchema } from "@/schemas/user";

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

  const save = (e: React.FormEvent) => {
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
    if (
      useProjectStore.getState().isEmailTaken(result.data.email, user.user_id)
    ) {
      setErrors({ email: "Another account already uses this email." });
      return;
    }
    updateUser(user.user_id, {
      ...result.data,
      title: result.data.title || undefined,
    });
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
  const confirm = useConfirm();
  const user = useCurrentUser();
  const [emailNotifications, setEmailNotifications] = React.useState(true);

  const resetData = async () => {
    const ok = await confirm({
      title: "Reset all local data?",
      description:
        "Your plans, projects, files, and tasks on this device are deleted and the sample data comes back. This can't be undone.",
      confirmLabel: "Reset data",
    });
    if (!ok) return;

    clearPersistedState();
    // Reload rather than rehydrating in place: every store seeds itself on
    // startup, and a partial reset would leave them disagreeing.
    window.location.reload();
  };

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
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm">
              Email me when a committee makes a decision
            </span>
            <Toggle
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </label>
        </section>
        <section className="space-y-4 rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Local data</h2>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Reset demo data</p>
              <p className="text-xs text-muted-foreground">
                Plans, projects, files, and tasks are saved in this browser.
                Resetting deletes them and restores the samples.
              </p>
            </div>
            <Button variant="outline" onClick={resetData}>
              Reset data
            </Button>
          </div>
        </section>
      </div>
    </>
  );
};
