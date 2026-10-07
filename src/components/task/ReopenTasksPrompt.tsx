import React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDmpStore } from "@/store/dmpStore";
import { useTaskStore } from "@/store/taskStore";
import { useToastStore } from "@/store/toastStore";
import { STATUS_LABELS } from "@/components/task/TaskMeta";

/**
 * Tasks cancelled when their output was removed, now that the output is back.
 * Their cancellation went through sign-off, so nothing is reopened for you:
 * each one is chosen, goes back to the status it had, and is linked to the
 * output as it returned.
 */
export const ReopenTasksPrompt: React.FC = () => {
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const offers = useTaskStore((s) => s.reopenOffers);
  const reopenFromOffer = useTaskStore((s) => s.reopenFromOffer);
  const dismiss = useTaskStore((s) => s.dismissReopenOffer);
  const toast = useToastStore((s) => s.toast);
  const offer = offers.find((o) => o.dmp_id === currentDmpId);
  const [chosen, setChosen] = React.useState<string[]>([]);

  if (!offer) return null;

  const toggle = (id: string) =>
    setChosen((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );

  return (
    <section
      aria-label="Reopen cancelled tasks"
      className="rounded-lg border bg-card p-5 text-left"
    >
      <h2 className="text-sm font-semibold">
        Version {offer.version} brought back an output with cancelled tasks
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        They were cancelled when the output was removed. Choose any to reopen —
        each returns to the status it had. The rest stay cancelled.
      </p>

      <ul className="mt-3 space-y-2">
        {offer.items.map((item) => (
          <li key={item.task_id}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                id={`reopen-${item.task_id}`}
                type="checkbox"
                className="mt-1"
                checked={chosen.includes(item.task_id)}
                onChange={() => toggle(item.task_id)}
              />
              <span className="min-w-0">
                <span className="block font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground">
                  Back to {STATUS_LABELS[item.restore_to]} · {item.output_title}
                  {item.relinked &&
                    " — relinked: the output returned under a new id"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={chosen.length === 0}
          onClick={() => {
            const n = reopenFromOffer(offer.offer_id, chosen);
            setChosen([]);
            toast({
              title: `${n} task${n === 1 ? "" : "s"} reopened`,
              description: "Each is back to the status it had before.",
            });
          }}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reopen {chosen.length > 0 ? chosen.length : ""} selected
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            dismiss(offer.offer_id);
            setChosen([]);
          }}
        >
          Keep them all cancelled
        </Button>
      </div>
    </section>
  );
};
