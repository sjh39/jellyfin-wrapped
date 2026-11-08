import { formatDuration } from "@/lib/utils";
import type { SimpleItemDto } from "@/lib/queries";
import { Poster } from "@/components/wrapped/Poster";

interface MovieCardProps {
  item: SimpleItemDto;
  playbackTime?: number;
  episodeCount?: number;
  playCount?: number;
  onHide?: () => void;
}

export function MovieCard({
  item,
  playbackTime,
  episodeCount,
  playCount,
  onHide,
}: MovieCardProps) {
  return (
    <Poster
      item={item}
      onHide={onHide}
      meta={[
        item.productionYear ? String(item.productionYear) : null,
        item.communityRating
          ? `Rated ${item.communityRating.toFixed(1)}`
          : null,
        playCount !== undefined && playCount > 0
          ? `Played ${playCount} ${playCount === 1 ? "time" : "times"}`
          : null,
        episodeCount && episodeCount > 1 ? `${episodeCount} episodes` : null,
        playbackTime && episodeCount && episodeCount > 1
          ? `Watch time ${formatDuration(playbackTime)}`
          : null,
      ]}
    />
  );
}
