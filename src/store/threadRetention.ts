import type { ThreadEntry, ThreadTurn } from "@/store/aiThread";

export const keptOnClear = (entry: ThreadEntry): ThreadEntry | null => {
  if (entry.kind === "event") return entry;
  const turn = entry as ThreadTurn;
  const proposals = turn.proposals ?? [];
  const accepted = proposals.filter((p) => p.status === "accepted");
  if (accepted.length === 0) return null;
  if (accepted.length === proposals.length && !turn.rejections?.length)
    return turn;
  return { ...turn, proposals: accepted, rejections: undefined };
};

export const hasClearableChat = (entries: ThreadEntry[]) =>
  entries.some((e) => keptOnClear(e) !== e);
