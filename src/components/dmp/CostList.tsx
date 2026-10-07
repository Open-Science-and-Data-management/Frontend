import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { CURRENCY_CODES } from "@/schemas/shared";
import { useDmpStore } from "@/store/dmpStore";

export const CostList: React.FC = () => {
  const { draft, addCost, updateCost, removeCost } = useDmpStore();
  const confirm = useConfirm();
  const costs = draft.cost ?? [];
  const total = costs.reduce((sum, c) => sum + (c.value || 0), 0);
  const currency = costs[0]?.currency_code ?? "THB";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cost</h2>
          <p className="text-xs text-muted-foreground">
            AI can suggest line items — amounts are always entered by a person.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addCost}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add cost item
        </Button>
      </div>

      {costs.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No cost items yet.
        </p>
      )}

      <div className="space-y-3">
        {costs.map((cost) => (
          <div
            key={cost.cost_id}
            className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
          >
            <div>
              <label
                htmlFor={`cost-title-${cost.cost_id}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Title
              </label>
              <Input
                id={`cost-title-${cost.cost_id}`}
                value={cost.title}
                onChange={(e) =>
                  updateCost(cost.cost_id as string, { title: e.target.value })
                }
              />
            </div>
            <div>
              <label
                htmlFor={`cost-desc-${cost.cost_id}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Description
              </label>
              <Textarea
                id={`cost-desc-${cost.cost_id}`}
                rows={1}
                value={cost.description ?? ""}
                onChange={(e) =>
                  updateCost(cost.cost_id as string, {
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="w-28">
              <label
                htmlFor={`cost-value-${cost.cost_id}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Amount
              </label>
              <Input
                id={`cost-value-${cost.cost_id}`}
                type="number"
                min={0}
                value={cost.value}
                onChange={(e) =>
                  updateCost(cost.cost_id as string, {
                    value: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="w-28">
              <label
                htmlFor={`cost-currency-${cost.cost_id}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Currency
              </label>
              <Select
                id={`cost-currency-${cost.cost_id}`}
                value={cost.currency_code}
                onChange={(e) =>
                  updateCost(cost.cost_id as string, {
                    currency_code: e.target.value,
                  })
                }
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="self-end text-destructive hover:bg-destructive/10"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Remove this cost item?",
                    confirmLabel: "Remove",
                  })
                )
                  removeCost(cost.cost_id as string);
              }}
              aria-label={`Remove ${cost.title || "cost item"}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {costs.length > 0 && (
        <p className="text-right text-sm font-medium">
          Total: {total.toLocaleString()} {currency}
        </p>
      )}
    </div>
  );
};
