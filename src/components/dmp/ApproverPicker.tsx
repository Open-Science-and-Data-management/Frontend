import React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useProjectStore } from "@/store/projectStore";
import { userFullName } from "@/schemas/user/user.schema";
import type { Approver } from "@/store/dmpStore";

const SOMEONE_ELSE = "__other";

/**
 * Who on the committee is deciding. The project's own committee members are
 * offered first, with their details filled in; anyone else is entered by hand.
 * Reports `undefined` until there's a name and a position, since both
 * standards' approval records need them.
 */
export const ApproverPicker: React.FC<{
  projectId?: string;
  onChange: (approver: Approver | undefined) => void;
}> = ({ projectId, onChange }) => {
  const users = useProjectStore((s) => s.users);
  const members = useProjectStore((s) => s.members);

  const committee = React.useMemo(
    () =>
      members
        .filter(
          (m) => m.project_id === projectId && m.project_role === "committee",
        )
        .map((m) => users.find((u) => u.user_id === m.user_id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u)),
    [members, users, projectId],
  );

  const [choice, setChoice] = React.useState<string>(
    committee[0]?.user_id ?? SOMEONE_ELSE,
  );
  const [name, setName] = React.useState("");
  const [position, setPosition] = React.useState("Committee member");
  const [mbox, setMbox] = React.useState("");

  const member = committee.find((u) => u.user_id === choice);

  React.useEffect(() => {
    const resolved: Approver | undefined = member
      ? {
          user_id: member.user_id,
          name: userFullName(member),
          position: position.trim() || "Committee member",
          mbox: member.email,
        }
      : name.trim() && position.trim()
        ? {
            name: name.trim(),
            position: position.trim(),
            mbox: mbox.trim() || undefined,
          }
        : undefined;
    onChange(resolved);
    // onChange is a fresh closure each render; the inputs are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, name, position, mbox]);

  return (
    <div className="grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
        Decided by
        <Select
          id="approver-member"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          {committee.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {userFullName(u)} · project committee
            </option>
          ))}
          <option value={SOMEONE_ELSE}>Someone else…</option>
        </Select>
      </label>
      {!member && (
        <>
          <Input
            id="approver-name"
            aria-label="Approver's name"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="approver-mbox"
            type="email"
            aria-label="Approver's email"
            placeholder="Email (optional)"
            value={mbox}
            onChange={(e) => setMbox(e.target.value)}
          />
        </>
      )}
      <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
        Their position
        <Input
          id="approver-position"
          placeholder="e.g. Committee chair"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
      </label>
    </div>
  );
};
