import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { startersFor } from "@/domain/projects/starters";
import type { ProjectKind } from "@/domain/projects/types";

/** UUIDv5 namespaces each preset item under its project, independent of renders. */
export function starterTaskIds(projectId: string, kind: ProjectKind) {
  const namespace = Buffer.from(
    z.uuid().parse(projectId).replaceAll("-", ""),
    "hex",
  );
  return Object.fromEntries(
    startersFor(kind).flatMap((starter) =>
      starter.tasks.map(([key]) => {
        const name = `${starter.key}:${key}`;
        const bytes = createHash("sha1")
          .update(namespace)
          .update(name)
          .digest();
        bytes[6] = (bytes[6]! & 0x0f) | 0x50;
        bytes[8] = (bytes[8]! & 0x3f) | 0x80;
        const hex = bytes.subarray(0, 16).toString("hex");
        return [
          name,
          `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
        ];
      }),
    ),
  );
}
