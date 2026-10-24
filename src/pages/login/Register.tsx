import React from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, User, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AuthField,
  AuthLayout,
  PasswordInput,
} from "@/components/auth/AuthLayout";
import { registrationSchema } from "@/schemas/user";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/utils/cn";

type AccountType = "institutional" | "citizen";

const ACCOUNT_TYPES: {
  value: AccountType;
  icon: typeof Building2;
  title: string;
  thai: string;
  description: string;
}[] = [
  {
    value: "institutional",
    icon: Building2,
    title: "Institutional researcher",
    thai: "มีสังกัด",
    description:
      "You belong to a university, institute or agency. Your plans go to its committee for approval.",
  },
  {
    value: "citizen",
    icon: User,
    title: "Citizen researcher",
    thai: "ไม่มีสังกัด",
    description:
      "You research independently. You finalize your own plans, and your evidence stands behind them.",
  },
];

const TITLES = [
  "Mr.",
  "Ms.",
  "Mrs.",
  "Dr.",
  "Asst. Prof.",
  "Assoc. Prof.",
  "Prof.",
];

const EMPTY = {
  title: "",
  name: "",
  surname: "",
  email: "",
  phone: "",
  orcid: "",
  organization: "",
  department: "",
  position: "",
  address: "",
  username: "",
  password: "",
  confirm_password: "",
};
type TextField = keyof typeof EMPTY;

/** A heading for each part of the form, numbered like the steps they are. */
const Step: React.FC<{
  n: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ n, title, description, children }) => (
  <section className="space-y-4 rounded-lg border bg-card p-6">
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {n}
      </span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
    {children}
  </section>
);

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const isUsernameTaken = useAuthStore((s) => s.isUsernameTaken);
  const toast = useToastStore((s) => s.toast);

  const [accountType, setAccountType] =
    React.useState<AccountType>("institutional");
  const [values, setValues] = React.useState(EMPTY);
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>(
    {},
  );
  const [submitting, setSubmitting] = React.useState(false);

  const institutional = accountType === "institutional";

  /** Props for a text input bound to `key`, clearing its error as it changes. */
  const bind = (key: TextField) => ({
    value: values[key],
    invalid: Boolean(errors[key]),
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registrationSchema.safeParse({
      ...values,
      account_type: accountType,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0]);
        next[key] ??= issue.message;
      });
      setErrors(next);
      // Take the person to the first thing that needs fixing.
      const first = Object.keys(next)[0];
      document.getElementById(`reg-${first}`)?.focus();
      return;
    }

    setSubmitting(true);
    const result = await register(parsed.data);
    setSubmitting(false);
    if (!result.ok) {
      setErrors({ [result.field ?? "username"]: result.error });
      document.getElementById(`reg-${result.field ?? "username"}`)?.focus();
      return;
    }

    toast({
      title: `Welcome, ${parsed.data.name}`,
      description: "Your account is ready. Start by creating a project.",
    });
    navigate("/", { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>Sign up | DMP-Researcher</title>
      </Helmet>

      <AuthLayout width="lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign up as a researcher to draft and manage your Data Management
            Plans.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Step
            n={1}
            title="Account type"
            description="This decides who approves your plans. You can't change it later."
          >
            <div
              role="radiogroup"
              aria-label="Account type"
              className="grid gap-3 sm:grid-cols-2"
            >
              {ACCOUNT_TYPES.map((type) => {
                const selected = type.value === accountType;
                return (
                  <button
                    key={type.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAccountType(type.value)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary ring-1 ring-primary"
                        : "hover:border-primary/50",
                    )}
                  >
                    <type.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {type.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {type.thai}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {type.description}
                      </span>
                    </span>
                    {selected && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={2} title="Personal information">
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr_1fr]">
              <AuthField id="reg-title" label="Title" optional>
                {(field) => (
                  <Select {...field} {...bind("title")}>
                    <option value="">None</option>
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                )}
              </AuthField>
              <AuthField id="reg-name" label="First name" error={errors.name}>
                {(field) => (
                  <Input
                    {...field}
                    {...bind("name")}
                    autoComplete="given-name"
                  />
                )}
              </AuthField>
              <AuthField
                id="reg-surname"
                label="Last name"
                error={errors.surname}
              >
                {(field) => (
                  <Input
                    {...field}
                    {...bind("surname")}
                    autoComplete="family-name"
                  />
                )}
              </AuthField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField id="reg-email" label="Email" error={errors.email}>
                {(field) => (
                  <Input
                    {...field}
                    {...bind("email")}
                    type="email"
                    autoComplete="email"
                  />
                )}
              </AuthField>
              <AuthField
                id="reg-phone"
                label="Phone"
                optional
                error={errors.phone}
              >
                {(field) => (
                  <Input
                    {...field}
                    {...bind("phone")}
                    type="tel"
                    autoComplete="tel"
                    placeholder="e.g. 081 234 5678"
                  />
                )}
              </AuthField>
            </div>
            <AuthField
              id="reg-orcid"
              label="ORCID iD"
              optional
              error={errors.orcid}
              hint="Used to identify you as a contributor on your plans."
            >
              {(field) => (
                <Input
                  {...field}
                  {...bind("orcid")}
                  placeholder="0000-0002-1825-0097"
                />
              )}
            </AuthField>
          </Step>

          {institutional ? (
            <Step
              n={3}
              title="Affiliation (สังกัด)"
              description="The organisation whose committee will approve your plans."
            >
              <AuthField
                id="reg-organization"
                label="Organisation"
                error={errors.organization}
              >
                {(field) => (
                  <Input
                    {...field}
                    {...bind("organization")}
                    autoComplete="organization"
                    placeholder="e.g. King Mongkut's Institute of Technology Ladkrabang"
                  />
                )}
              </AuthField>
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthField
                  id="reg-department"
                  label="Faculty / department"
                  optional
                >
                  {(field) => (
                    <Input
                      {...field}
                      {...bind("department")}
                      placeholder="e.g. Faculty of Science"
                    />
                  )}
                </AuthField>
                <AuthField id="reg-position" label="Position" optional>
                  {(field) => (
                    <Input
                      {...field}
                      {...bind("position")}
                      autoComplete="organization-title"
                      placeholder="e.g. Lecturer, PhD student"
                    />
                  )}
                </AuthField>
              </div>
            </Step>
          ) : (
            <Step
              n={3}
              title="Address (ที่อยู่)"
              description="You aren't affiliated with an organisation, so nobody else signs your plans off."
            >
              <AuthField
                id="reg-address"
                label="Address"
                optional
                hint="Where you're based, e.g. district and province."
              >
                {(field) => (
                  <Textarea
                    {...field}
                    {...bind("address")}
                    rows={2}
                    autoComplete="street-address"
                  />
                )}
              </AuthField>
            </Step>
          )}

          <Step n={4} title="Sign-in details">
            <AuthField
              id="reg-username"
              label="Username"
              error={errors.username}
              hint="Lowercase letters, numbers, dots, dashes or underscores."
            >
              {(field) => (
                <Input
                  {...field}
                  {...bind("username")}
                  autoComplete="username"
                  autoCapitalize="none"
                  onBlur={() => {
                    if (
                      values.username.trim() &&
                      isUsernameTaken(values.username)
                    )
                      setErrors((err) => ({
                        ...err,
                        username: "That username is already taken.",
                      }));
                  }}
                />
              )}
            </AuthField>
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField
                id="reg-password"
                label="Password"
                error={errors.password}
                hint="At least 8 characters, with a letter and a number."
              >
                {(field) => (
                  <PasswordInput
                    {...field}
                    {...bind("password")}
                    autoComplete="new-password"
                  />
                )}
              </AuthField>
              <AuthField
                id="reg-confirm_password"
                label="Re-enter password"
                error={errors.confirm_password}
              >
                {(field) => (
                  <PasswordInput
                    {...field}
                    {...bind("confirm_password")}
                    autoComplete="new-password"
                  />
                )}
              </AuthField>
            </div>
          </Step>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={submitting}
          >
            {!submitting && <UserPlus className="mr-2 h-4 w-4" />}
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </AuthLayout>
    </>
  );
};
