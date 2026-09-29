import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DatasetCard } from "@/components/dmp/DatasetCard";
import { DatasetType } from "@/schemas/shared";
import { useDmpStore } from "@/store/dmpStore";
import type { Dataset } from "@/types/dataset";

export const DatasetList: React.FC = () => {
  const { draft, addDataset } = useDmpStore();
  const datasets = draft.dataset ?? [];
  const [newType, setNewType] = React.useState<Dataset["type"]>("raw");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Research outputs</h2>
          <p className="text-xs text-muted-foreground">
            Datasets, software, or publications this plan produces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="New output type"
            className="w-32"
            value={newType}
            onChange={(e) => setNewType(e.target.value as Dataset["type"])}
          >
            {DatasetType.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={() => addDataset(newType)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add output
          </Button>
        </div>
      </div>

      {datasets.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No research outputs yet — add at least one to submit.
        </p>
      )}

      <div className="space-y-3">
        {datasets.map((dataset) => (
          <DatasetCard key={dataset.dataset_id} dataset={dataset} />
        ))}
      </div>
    </div>
  );
};
