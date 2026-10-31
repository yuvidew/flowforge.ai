"use client";

import { useMemo } from "react";
import { useOthers, useSelf } from "@liveblocks/react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Most avatars shown before the rest collapse into a "+N" bubble.
const MAX_VISIBLE = 4;

type Person = { id: string; name: string; avatar: string; color: string; isSelf: boolean };

// Up to two initials from a full name, for the avatar fallback.
const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/**
 * @component WorkspacePresence
 * @description Avatar stack of everyone currently on this board (you first), each ringed in the colour of their cursor, with the name on hover. A person with several tabs open appears once.
 */
export const WorkspacePresence = () => {
  const self = useSelf();
  const others = useOthers();

  // One entry per person: you first, then everyone else de-duplicated by user id.
  const people = useMemo(() => {
    const list: Person[] = [];
    const seen = new Set<string>();

    if (self) {
      seen.add(self.id);
      list.push({ id: self.id, ...self.info, isSelf: true });
    }
    for (const other of others) {
      if (seen.has(other.id)) continue;
      seen.add(other.id);
      list.push({ id: other.id, ...other.info, isSelf: false });
    }
    return list;
  }, [self, others]);

  if (people.length === 0) return null;

  const visible = people.slice(0, MAX_VISIBLE);
  const hidden = people.slice(MAX_VISIBLE);

  return (
    <AvatarGroup aria-label={`${people.length} ${people.length === 1 ? "person" : "people"} on this board`}>
      {visible.map((person) => (
        <Tooltip key={person.id}>
          <TooltipTrigger
            // The group already adds a ring; this recolours it to the person's cursor colour.
            render={<Avatar className="cursor-default" style={{ "--tw-ring-color": person.color } as React.CSSProperties} />}
          >
            <AvatarImage src={person.avatar} alt={person.name} />
            <AvatarFallback style={{ backgroundColor: person.color, color: "white" }}>
              {getInitials(person.name)}
            </AvatarFallback>
          </TooltipTrigger>
          <TooltipContent side="bottom">{person.isSelf ? `${person.name} (you)` : person.name}</TooltipContent>
        </Tooltip>
      ))}

      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger render={<AvatarGroupCount className="cursor-default" />}>+{hidden.length}</TooltipTrigger>
          <TooltipContent side="bottom">{hidden.map((person) => person.name).join(", ")}</TooltipContent>
        </Tooltip>
      )}
    </AvatarGroup>
  );
};
