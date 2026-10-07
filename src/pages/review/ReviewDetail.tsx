import React from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FolderKanban,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DmpReview } from "@/components/dmp/DmpReview";
import { ChangeList } from "@/components/review/ChangeList";
import { VersionHistory } from "@/components/review/VersionHistory";
import { reviewedSnapshot, useDmpLibrary } from "@/hooks/useDmpLibrary";
import { computeReadiness } from "@/hooks/useDmpReadiness";
import { planModeOf, statusLabel } from "@/config/plan-mode";
import { userFullName } from "@/schemas/user";
import { useCurrentUser } from "@/store/authStore";
import { useDmpStore, type Approver } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import { useToastStore } from "@/store/toastStore";

type Decision = "approve" | "return";

export const ReviewDetail: React.FC = () => {
  const { dmpId } = useParams<{ dmpId: string }>();
  const navigate = useNavigate();
  const library = useDmpLibrary();
  const reviewer = useCurrentUser();
  const approveDmp = useDmpStore((s) => s.approveDmp);
  const returnDmp = useDmpStore((s) => s.returnDmp);
  const projects = useProjectStore((s) => s.projects);
  const getResearcherFor = useProjectStore((s) => s.getResearcherFor);
  const toast = useToastStore((s) => s.toast);

  const [note, setNote] = React.useState("");
  // The exports name who approved a plan and in what capacity, so the
  // position is asked for; the person is whoever is signed in.
  const [position, setPosition] = React.useState("Committee member");
  const [confirming, setConfirming] = React.useState<Decision | null>(null);

  const record = library.find((d) => d.dmp_id === dmpId);

  if (!record) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-medium">Plan not found</p>
        <Button variant="outline" asChild>
          <Link to="/review">Back to the review queue</Link>
        </Button>
      </div>
    );
  }

  const project = projects.find((p) => p.project_id === record.project_id);
  const researcher = getResearcherFor(record.project_id);
  const pending = record.versions.find((v) => v.status === "pending");
  const active = record.versions.find(
    (v) => v.number === record.active_version,
  );
  const isRevision = Boolean(pending && active);
  const snapshot = reviewedSnapshot(record);
  const readiness = computeReadiness(snapshot);

  const approver: Approver | undefined =
    reviewer && position.trim()
      ? {
          user_id: reviewer.user_id,
          name: userFullName(reviewer),
          position: position.trim(),
          mbox: reviewer.email,
        }
      : undefined;

  const decide = () => {
    if (!pending || !approver || !confirming) return;
    if (confirming === "approve") {
      approveDmp(record.dmp_id, approver, note);
      toast({
        title: `Version ${pending.number} approved`,
        description: researcher
          ? `${userFullName(researcher)} has been notified.`
          : undefined,
      });
    } else {
      returnDmp(record.dmp_id, approver, note.trim());
      toast({
        title: `Version ${pending.number} sent back`,
        description: "Your comments went to the researcher.",
      });
    }
    setConfirming(null);
    navigate("/review");
  };

  return (
    <>
      <Helmet>
        <title>Review: {record.title} | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/review">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Review queue
          </Link>
        </Button>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {record.title}
            </h1>
            <StatusBadge status={record.status}>
              {/* The mode frozen on submission, not the project's today. */}
              {statusLabel(record.status, planModeOf(record, projects))}
            </StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[
              project?.project_name,
              researcher && userFullName(researcher),
              pending && `submitted ${format(pending.created_at, "PP")}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {pending && (
            <div className="flex flex-wrap gap-1.5">
              <Chip variant="outline">Version {pending.number}</Chip>
              {isRevision ? (
                <Chip variant="warn">Revision of version {active?.number}</Chip>
              ) : (
                <Chip variant="ai">First submission</Chip>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            {isRevision && pending && (
              <section className="rounded-lg border border-warn/40 bg-card p-5">
                <h2 className="font-semibold">
                  What changed since version {active?.number}
                </h2>
                <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                  Version {active?.number} stays in force — and its tasks keep
                  running — until you decide.
                </p>
                <ChangeList changes={pending.changes} />
              </section>
            )}

            {!pending && (
              <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                {active
                  ? `Showing version ${active.number}, the one in force.`
                  : "Showing the researcher's current draft — it hasn't been submitted."}
              </p>
            )}

            <DmpReview draft={snapshot} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {pending ? (
              <section className="space-y-3 rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold">Your decision</h2>
                <div>
                  <label
                    htmlFor="review-position"
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Recorded as {reviewer ? userFullName(reviewer) : "—"},
                    position
                  </label>
                  <Input
                    id="review-position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Committee chair"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="review-note"
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Comments for the researcher
                  </label>
                  <Textarea
                    id="review-note"
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Required when sending it back — say what needs to change."
                    className="text-sm"
                  />
                </div>
                <Button
                  className="w-full"
                  variant="ok"
                  disabled={!approver}
                  onClick={() => setConfirming("approve")}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve version {pending.number}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={!note.trim() || !approver}
                  onClick={() => setConfirming("return")}
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  Send back
                </Button>
                {!note.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Add a comment to send it back.
                  </p>
                )}
              </section>
            ) : (
              <section className="rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold">No decision pending</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This plan isn't waiting on the committee right now.
                </p>
              </section>
            )}

            <section className="space-y-2 rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">Completeness</h2>
              {readiness.canSubmit ? (
                <p className="flex items-start gap-1.5 text-xs text-ok">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Every required field is filled in and valid.
                </p>
              ) : (
                <>
                  <p className="flex items-start gap-1.5 text-xs text-warn">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {readiness.unmetItems.length} item
                    {readiness.unmetItems.length === 1 ? "" : "s"} still
                    incomplete:
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                    {readiness.unmetItems.map((item) => (
                      <li key={item.label}>{item.label}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="space-y-3 rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">Version history</h2>
              <VersionHistory record={record} />
            </section>

            {project && (
              <Button variant="outline" className="w-full" asChild>
                <Link to={`/projects/${project.project_id}`}>
                  <FolderKanban className="mr-2 h-4 w-4" />
                  Project &amp; progress
                </Link>
              </Button>
            )}
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming === "approve"
            ? `Approve version ${pending?.number}?`
            : `Send version ${pending?.number} back?`
        }
        description={
          confirming === "approve"
            ? isRevision
              ? "It replaces the version in force, and the researcher's tasks run against it from now on."
              : "The plan becomes active and the researcher can break it into tasks."
            : isRevision
              ? "The version in force keeps running. The researcher sees your comments and can revise."
              : "The plan goes back to draft with your comments, for the researcher to revise and resubmit."
        }
        confirmLabel={confirming === "approve" ? "Approve" : "Send back"}
        cancelLabel="Keep reviewing"
        onConfirm={decide}
      />
    </>
  );
};
