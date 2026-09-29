import React from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { contributorFullName } from "@/schemas/contributor";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";

const EMPTY = "—";

const fmtDate = (d: Date | undefined) => (d ? format(d, "PP") : EMPTY);

const Section: React.FC<{
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}> = ({ title, onEdit, children }) => (
  <section className="rounded-lg border bg-card p-5">
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="font-semibold">{title}</h2>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        Edit
      </Button>
    </div>
    {children}
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-sm wrap-break-words">{children || EMPTY}</dd>
  </div>
);

interface DmpReviewProps {
  onEditSection: (section: string) => void;
}

export const DmpReview: React.FC<DmpReviewProps> = ({ onEditSection }) => {
  const { draft } = useDmpStore();
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.project_id === draft.project_id),
  );
  const datasets = draft.dataset ?? [];
  const contributors = draft.contributor ?? [];
  const costs = draft.cost ?? [];
  const costTotal = costs.reduce((sum, c) => sum + (c.value || 0), 0);

  return (
    <div className="space-y-4">
      <Section title="General" onEdit={() => onEditSection("general")}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title">{draft.title}</Field>
          <Field label="Language">{draft.language}</Field>
          <div className="sm:col-span-2">
            <Field label="Description">{draft.description}</Field>
          </div>
          <Field label="Alternate identifier">
            {draft.alternate_identifier?.identifier
              ? `${draft.alternate_identifier.type}: ${draft.alternate_identifier.identifier}`
              : EMPTY}
          </Field>
          <Field label="Timeline">
            {fmtDate(draft.begin_date)} → {fmtDate(draft.end_date)}
          </Field>
        </dl>
      </Section>

      <Section title="Ethical" onEdit={() => onEditSection("ethical")}>
        <dl className="grid grid-cols-1 gap-4">
          <Field label="Ethical issues">
            {draft.ethical_issues_exist
              ? "Yes — issues apply"
              : "No ethical issues"}
          </Field>
          {draft.ethical_issues_exist && (
            <>
              <Field label="Description">
                {draft.ethical_issues_description}
              </Field>
              <Field label="Report">
                {draft.ethical_issues_report ? (
                  <a
                    href={draft.ethical_issues_report}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary underline underline-offset-2"
                  >
                    {draft.ethical_issues_report}
                  </a>
                ) : null}
              </Field>
            </>
          )}
          <Field label="Indigenous data considerations">
            {draft.indigenous_considerations || "Not applicable"}
          </Field>
        </dl>
      </Section>

      <Section
        title={`Research outputs (${datasets.length})`}
        onEdit={() => onEditSection("dataset")}
      >
        <div className="space-y-4">
          {datasets.map((d) => (
            <div
              key={d.dataset_id}
              className="rounded-md border bg-muted/20 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {d.title || "Untitled output"}
                </span>
                <StatusBadge status="draft">{d.type}</StatusBadge>
                <span className="text-xs text-muted-foreground capitalize">
                  {d.status}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Access">{d.access}</Field>
                <Field label="Personal data">{d.personal_data}</Field>
                <Field label="Sensitive data">{d.sensitive_data}</Field>
                <Field label="Protection">
                  {d.protection_level === "Other"
                    ? d.protection_level_other
                    : d.protection_level}
                </Field>
                <Field label="Security">
                  {d.security_classification_level === "Other"
                    ? d.security_classification_level_other
                    : d.security_classification_level}
                </Field>
                <Field label="Distributions">{d.distribution.length}</Field>
                {d.type === "raw" && (
                  <Field label="Schema fields">{d.schema_fields.length}</Field>
                )}
                {d.type === "software" && (
                  <Field label="Repository">{d.repository_url}</Field>
                )}
              </dl>
              {d.keyword.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {d.keyword.map((k) => (
                    <Chip key={k} variant="neutral">
                      {k}
                    </Chip>
                  ))}
                </div>
              )}
              {d.preservation?.statement && (
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium">Preservation:</span>{" "}
                  {d.preservation.statement}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="People & cost" onEdit={() => onEditSection("people")}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Contributors ({contributors.length})
            </p>
            <ul className="space-y-2">
              {contributors.map((c) => (
                <li
                  key={c.contributor_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {contributorFullName(c) || "Unnamed contributor"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.role}
                      {c.email ? ` · ${c.email}` : ""}
                      {c.orcid ? ` · ORCID ${c.orcid}` : ""}
                    </p>
                  </div>
                  {c.is_contact && <Chip variant="ok">Primary contact</Chip>}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Cost ({costs.length})
            </p>
            {costs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cost items.</p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {costs.map((c) => (
                    <li
                      key={c.cost_id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span>{c.title || "Untitled item"}</span>
                      <span className="tabular-nums">
                        {c.value.toLocaleString()} {c.currency_code}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 border-t pt-2 text-right text-sm font-medium">
                  Total: {costTotal.toLocaleString()} {costs[0]?.currency_code}
                </p>
              </>
            )}
          </div>
        </div>
      </Section>

      <Section title="System info" onEdit={() => onEditSection("system")}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Schema version">{draft.schema_version}</Field>
          <Field label="Project">
            {project?.project_name ?? draft.project_id}
          </Field>
        </dl>
      </Section>
    </div>
  );
};
