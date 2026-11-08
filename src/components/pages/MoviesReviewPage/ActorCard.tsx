import type { BaseItemPerson } from "@jellyfin/sdk/lib/generated-client";
import type { SimpleItemDto } from "@/lib/queries";
import { Poster } from "@/components/wrapped/Poster";

interface ActorCardProps {
  name: string;
  count: number;
  details: BaseItemPerson;
  seenInMovies: SimpleItemDto[];
  seenInShows: SimpleItemDto[];
}

export function ActorCard({
  name,
  count,
  details,
  seenInMovies,
  seenInShows,
}: ActorCardProps) {
  const titles = [...seenInMovies, ...seenInShows]
    .map((item) => item.name)
    .filter((title): title is string => !!title);
  const shown = titles.slice(0, 3).join(", ");
  return (
    <Poster
      item={{ id: details.Id, name }}
      meta={[
        count > 0 ? `Watched ${count} ${count === 1 ? "time" : "times"}` : null,
        shown
          ? titles.length > 3
            ? `${shown} and ${titles.length - 3} more`
            : shown
          : null,
      ]}
    />
  );
}
