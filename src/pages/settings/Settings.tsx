import React from "react";
import { Helmet } from "react-helmet-async";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useTheme } from "@/components/ui/ThemeProvider";

export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [emailNotifications, setEmailNotifications] = React.useState(true);

  return (
    <>
      <Helmet>
        <title>Settings | DMP-Researcher</title>
      </Helmet>

      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

        <section className="space-y-4 rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <Input id="settings-name" defaultValue="Researcher" />
            </div>
            <div>
              <label htmlFor="settings-email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <Input id="settings-email" type="email" defaultValue="researcher@example.edu" />
            </div>
          </div>
        </section>

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
              onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
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
            <span className="text-sm">Email me when a committee makes a decision</span>
            <Toggle checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </label>
        </section>
      </div>
    </>
  );
};
