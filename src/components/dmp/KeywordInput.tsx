import React from "react";
import { X } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  id?: string;
}

export const KeywordInput: React.FC<KeywordInputProps> = ({
  keywords,
  onChange,
  id,
}) => {
  const [draft, setDraft] = React.useState("");

  const commit = () => {
    const value = draft.trim();
    if (value && !keywords.includes(value)) {
      onChange([...keywords, value]);
    }
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((keyword) => (
            <Chip key={keyword} variant="neutral">
              {keyword}
              <button
                type="button"
                onClick={() => onChange(keywords.filter((k) => k !== keyword))}
                aria-label={`Remove keyword ${keyword}`}
                className="ml-0.5 rounded-full hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </Chip>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(e) => {
          if (e.target.value.endsWith(",")) {
            setDraft(e.target.value.slice(0, -1));
            commit();
            return;
          }
          setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder="Type a keyword and press Enter"
      />
    </div>
  );
};
