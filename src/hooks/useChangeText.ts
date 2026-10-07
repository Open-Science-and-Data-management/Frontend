import { useCallback } from "react";
import type { FieldChange } from "@/config/plan-diff";
import { userFullName } from "@/schemas/user";
import { useProjectStore } from "@/store/projectStore";

/**
 * A change's "from → to" as a person should read it. Diffs hold raw values,
 * and a linked account is an id there; here it becomes the account's name.
 */
export const useChangeText = () => {
  const users = useProjectStore((s) => s.users);
  return useCallback(
    (change: FieldChange) => {
      if (change.target?.field !== "user_id")
        return `${change.from} → ${change.to}`;
      const name = (id: string) => {
        if (id === "—") return "No account";
        const user = users.find((u) => u.user_id === id);
        return user ? userFullName(user) : "Unknown account";
      };
      return `${name(change.from)} → ${name(change.to)}`;
    },
    [users],
  );
};
