import React from "react";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { schemaFieldSchema } from "@/schemas/dataset";

type SchemaField = z.infer<typeof schemaFieldSchema>;

interface SchemaFieldTableProps {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
}

export const SchemaFieldTable: React.FC<SchemaFieldTableProps> = ({
  fields,
  onChange,
}) => {
  const update = (index: number, patch: Partial<SchemaField>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const remove = (index: number) =>
    onChange(fields.filter((_, i) => i !== index));

  const add = () => onChange([...fields, { name: "", type: "" }]);

  return (
    <div className="space-y-2">
      {fields.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Type</th>
                <th className="p-2 font-medium">Description</th>
                <th className="w-8 p-2" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-1.5">
                    <Input
                      aria-label="Field name"
                      value={field.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      aria-label="Field type"
                      value={field.type}
                      onChange={(e) => update(i, { type: e.target.value })}
                      className="h-8"
                      placeholder="e.g. string"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      aria-label="Field description"
                      value={field.description ?? ""}
                      onChange={(e) =>
                        update(i, { description: e.target.value })
                      }
                      className="h-8"
                    />
                  </td>
                  <td className="p-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => remove(i)}
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add field
      </Button>
    </div>
  );
};
