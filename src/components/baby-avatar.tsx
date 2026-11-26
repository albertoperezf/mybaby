import clsx from "clsx";
import type { Baby } from "@/db/types";

const SIZES = { sm: "size-9 text-lg", md: "size-12 text-2xl", lg: "size-16 text-4xl" };

/** Round badge in the baby's own colour; decorative, since the name is always shown next to it. */
export function BabyAvatar({ baby, size = "md", className }: { baby: Pick<Baby, "name" | "color" | "avatar">; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ background: `${baby.color}2e`, borderColor: baby.color }}
      className={clsx("grid shrink-0 place-items-center rounded-full border-2 font-extrabold", SIZES[size], className)}
    >
      {baby.avatar ?? baby.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
