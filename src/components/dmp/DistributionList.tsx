import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataAccess } from "@/schemas/shared";
import type { Distribution } from "@/types/dataset";

interface DistributionListProps {
  distributions: Distribution[];
  onChange: (distributions: Distribution[]) => void;
}

const makeId = () => Math.random().toString(36).substring(2, 10);

export const DistributionList: React.FC<DistributionListProps> = ({
  distributions,
  onChange,
}) => {
  const update = (index: number, patch: Partial<Distribution>) =>
    onChange(distributions.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const remove = (index: number) =>
    onChange(distributions.filter((_, i) => i !== index));

  const add = () =>
    onChange([
      ...distributions,
      { distribution_id: makeId(), title: "", data_access: "shared" },
    ]);

  return (
    <div className="space-y-3">
      {distributions.map((dist, i) => (
        <div
          key={dist.distribution_id ?? i}
          className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2"
        >
          <Input
            aria-label="Distribution title"
            placeholder="Title"
            value={dist.title}
            onChange={(e) => update(i, { title: e.target.value })}
          />
          <Select
            aria-label="Access"
            value={dist.data_access}
            onChange={(e) =>
              update(i, {
                data_access: e.target.value as (typeof DataAccess.options)[number],
              })
            }
          >
            {DataAccess.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Access URL"
            placeholder="Access URL"
            value={dist.access_url ?? ""}
            onChange={(e) => update(i, { access_url: e.target.value })}
          />
          <Input
            aria-label="Download URL"
            placeholder="Download URL"
            value={dist.download_url ?? ""}
            onChange={(e) => update(i, { download_url: e.target.value })}
          />
          <Input
            aria-label="Format"
            placeholder="Format (e.g. CSV)"
            value={dist.format ?? ""}
            onChange={(e) => update(i, { format: e.target.value })}
          />
          <Input
            aria-label="License"
            placeholder="License (e.g. CC-BY-4.0)"
            value={dist.license ?? ""}
            onChange={(e) => update(i, { license: e.target.value })}
          />
          <div className="flex justify-end sm:col-span-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => remove(i)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove distribution
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add distribution
      </Button>
    </div>
  );
};
