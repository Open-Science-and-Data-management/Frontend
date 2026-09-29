import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contributorFullName } from "@/schemas/contributor";
import { useDmpStore } from "@/store/dmpStore";

export const ContributorList: React.FC = () => {
  const {
    draft,
    addContributor,
    updateContributor,
    removeContributor,
    setPrimaryContact,
  } = useDmpStore();
  const contributors = draft.contributor ?? [];
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
        <Button type="button" variant="outline" size="sm" onClick={addContributor}>
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
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
              <label className="flex items-center gap-1.5 self-end pb-2 text-xs font-medium">
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
                className="self-end text-destructive hover:bg-destructive/10"
                onClick={() => removeContributor(contributor.contributor_id as string)}
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
    </div>
  );
};
