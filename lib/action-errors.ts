import { Prisma } from "@/lib/generated/prisma/client";

export type ActionResult = { error: string | null; fieldErrors?: Record<string, string> };

// Thrown inside a transaction to abort it with a message safe to show the user.
export class UserFacingError extends Error {}

// With driver adapters the violated fields live in a nested meta object, so search it as text.
export function isUniqueViolation(e: unknown, field: string) {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2002" &&
    JSON.stringify(e.meta ?? {}).includes(field)
  );
}
