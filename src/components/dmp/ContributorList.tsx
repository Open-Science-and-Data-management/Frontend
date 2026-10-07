import React from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  contributorFullName,
  isValidEmail,
  suggestAccountFor,
} from "@/schemas/contributor";
import { userFullName } from "@/schemas/user";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";

export const ContributorList: React.FC = () => {
  const {
    draft,
    addContributor,
    updateContributor,
    removeContributor,
    setPrimaryContact,
  } = useDmpStore();
  const confirm = useConfirm();
  const users = useProjectStore((s) => s.users);
  const contributors = draft.contributor ?? [];
  // An account already linked to someone in this plan isn't offered again.
  const linkedIds = contributors
    .map((c) => c.user_id)
    .filter((id): id is string => Boolean(id));
  const contactCount = contributors.filter((c) => c.is_contact).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contributors</h2>
          <p className="text-xs text-muted-foreground">
            Exactly one contributor must be the primary contact.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addContributor}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add contributor
        </Button>
      </div>

      {contributors.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No contributors yet.
        </p>
      )}

      <div className="space-y-3">
        {contributors.map((contributor) => (
          <div
            key={contributor.contributor_id}
            className="space-y-3 rounded-lg border bg-card p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[7rem_1fr_1fr]">
              <div>
                <label
                  htmlFor={`contributor-title-${contributor.contributor_id}`}
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Title
                </label>
                <Input
                  id={`contributor-title-${contributor.contributor_id}`}
                  value={contributor.title ?? ""}
                  onChange={(e) =>
                    updateContributor(contributor.contributor_id as string, {
                      title: e.target.value,
                    })
                  }
                  placeholder="Dr."
                />
              </div>
              <div>
                <label
                  htmlFor={`contributor-name-${contributor.contributor_id}`}
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Name
                </label>
                <Input
                  id={`contributor-name-${contributor.contributor_id}`}
                  value={contributor.name}
                  onChange={(e) =>
                    updateContributor(contributor.contributor_id as string, {
                      name: e.target.value,
                    })
                  }
                  placeholder="Given name"
                />
              </div>
              <div>
                <label
                  htmlFor={`contributor-surname-${contributor.contributor_id}`}
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Surname
                </label>
                <Input
                  id={`contributor-surname-${contributor.contributor_id}`}
                  value={contributor.surname ?? ""}
                  onChange={(e) =>
                    updateContributor(contributor.contributor_id as string, {
                      surname: e.target.value,
                    })
                  }
                  placeholder="Family name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr]">
              <div>
                <label
                  htmlFor={`contributor-role-${contributor.contributor_id}`}
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Role
                </label>
                <Input
                  id={`contributor-role-${contributor.contributor_id}`}
                  value={contributor.role}
                  onChange={(e) =>
                    updateContributor(contributor.contributor_id as string, {
                      role: e.target.value,
                    })
                  }
                  placeholder="e.g. Principal Investigator"
                />
              </div>
              <div>
                <label
                  htmlFor={`contributor-orcid-${contributor.contributor_id}`}
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  ORCID
                </label>
                <Input
                  id={`contributor-orcid-${contributor.contributor_id}`}
                  value={contributor.orcid ?? ""}
                  onChange={(e) =>
                    updateContributor(contributor.contributor_id as string, {
                      orcid: e.target.value,
                    })
                  }
                  placeholder="0000-0000-0000-0000"
                />
              </div>
              <div>
                <label
                  htmlFor={`contributor-email-${contributor.contributor_id}`}
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Email
                  {contributor.is_contact && (
                    <span className="text-destructive"> *</span>
                  )}
                </label>
                <Input
                  id={`contributor-email-${contributor.contributor_id}`}
                  type="email"
                  value={contributor.email ?? ""}
                  invalid={
                    (Boolean(contributor.email) &&
                      !isValidEmail(contributor.email)) ||
                    (contributor.is_contact && !contributor.email)
                  }
                  onChange={(e) =>
                    updateContributor(contributor.contributor_id as string, {
                      email: e.target.value,
                    })
                  }
                  placeholder="name@university.edu"
                />
                {/* maDMP v3.0 requires the contact's email. */}
                {contributor.is_contact && !contributor.email && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    The contact needs an email address.
                  </p>
                )}
                {Boolean(contributor.email) &&
                  !isValidEmail(contributor.email) && (
                    <p className="mt-1 text-xs text-destructive" role="alert">
                      Enter a valid email address.
                    </p>
                  )}
              </div>
            </div>

            <LinkedAccount
              contributorId={contributor.contributor_id as string}
              userId={contributor.user_id}
              suggestion={suggestAccountFor(contributor, users, linkedIds)}
              options={users.filter(
                (u) =>
                  u.user_id === contributor.user_id ||
                  !linkedIds.includes(u.user_id ?? ""),
              )}
              missing={
                Boolean(contributor.user_id) &&
                !users.some((u) => u.user_id === contributor.user_id)
              }
              onChange={(user_id) =>
                updateContributor(contributor.contributor_id as string, {
                  user_id,
                })
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-1.5 text-xs font-medium">
                <input
                  type="radio"
                  name="primary_contact"
                  checked={contributor.is_contact}
                  onChange={() =>
                    setPrimaryContact(contributor.contributor_id as string)
                  }
                  className="h-3.5 w-3.5"
                />
                Primary contact
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Remove this contributor?",
                      confirmLabel: "Remove",
                    })
                  )
                    removeContributor(contributor.contributor_id as string);
                }}
                aria-label={`Remove ${contributorFullName(contributor) || "contributor"}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {contributors.length > 0 && contactCount !== 1 && (
        <p className="text-xs text-destructive" role="alert">
          {contactCount === 0
            ? "Select one contributor as the primary contact."
            : "Only one contributor can be the primary contact."}
        </p>
      )}

      {contactCount === 1 && !contributors.find((c) => c.is_contact)?.email && (
        <p className="text-xs text-warn" role="alert">
          The primary contact needs an email — it's how your committee reaches
          you, and it's exported as the plan's contact address.
        </p>
      )}
    </div>
  );
};

type AccountOption = ReturnType<
  typeof useProjectStore.getState
>["users"][number];

/**
 * Which of our accounts, if any, this contributor is. Optional — collaborators
 * from elsewhere have none — and never set for them: a matching email is
 * offered, not applied.
 */
const LinkedAccount: React.FC<{
  contributorId: string;
  userId?: string;
  options: AccountOption[];
  suggestion?: AccountOption;
  /** Linked to an account that no longer exists here. */
  missing: boolean;
  onChange: (userId: string | undefined) => void;
}> = ({ contributorId, userId, options, suggestion, missing, onChange }) => (
  <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[1fr_2fr] sm:items-center">
    <div className="sm:col-span-2">
      <label
        htmlFor={`contributor-user_id-${contributorId}`}
        className="block text-xs font-medium text-muted-foreground"
      >
        Linked account
      </label>
    </div>
    <Select
      id={`contributor-user_id-${contributorId}`}
      value={userId ?? ""}
      invalid={missing}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">No account</option>
      {missing && <option value={userId}>Unknown account</option>}
      {options.map((u) => (
        <option key={u.user_id} value={u.user_id}>
          {userFullName(u)} · {u.email}
        </option>
      ))}
    </Select>
    <div className="text-xs text-muted-foreground">
      {missing ? (
        <span className="text-destructive" role="alert">
          That account no longer exists here. Choose another, or none.
        </span>
      ) : suggestion ? (
        <button
          type="button"
          onClick={() => onChange(suggestion.user_id)}
          className="inline-flex items-center gap-1 rounded text-primary underline-offset-2 hover:underline"
        >
          <Link2 className="h-3.5 w-3.5" />
          Link to {userFullName(suggestion)} — same email
        </button>
      ) : userId ? (
        "This contributor is the person with that account."
      ) : (
        "Optional. Link it when this person has an account here."
      )}
    </div>
  </div>
);
