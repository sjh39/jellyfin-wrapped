import type { SimpleItemDto } from "@/lib/queries";
import { Thumb } from "./wrapped/Poster";

export function ContentImage({ item }: { item: SimpleItemDto }) {
  return <Thumb item={item} />;
}
