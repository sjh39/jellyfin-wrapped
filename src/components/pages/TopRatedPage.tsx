import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useMyRatings } from "@/hooks/queries/useMyRatings";
import { LoadingSpinner } from "../LoadingSpinner";
import { KIND_LABELS, MIN_RATINGS, stars } from "@/lib/queries";
import { getCurrentTimeframe } from "@/lib/timeframe";
import PageContainer from "../PageContainer";
import { Slide } from "../wrapped/Slide";
import { Poster, PosterGrid } from "../wrapped/Poster";

const TOP_RATING = 4;
const MAX_DISPLAY_ITEMS = 12;

// Everything the viewer gave four stars or more, best first.
export default function TopRatedPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: ratings, isLoading, error } = useMyRatings();

  if (error) showBoundary(error);
  if (isLoading) return <LoadingSpinner />;

  const top = (ratings ?? [])
    .filter((r) => r.rating >= TOP_RATING)
    .sort(
      (a, b) => b.rating - a.rating || b.ratedAt.getTime() - a.ratedAt.getTime()
    )
    .slice(0, MAX_DISPLAY_ITEMS);

  if ((ratings ?? []).length < MIN_RATINGS || !top.length) {
    return (
      <EmptyState
        title="No ratings yet"
        message="Rate what you watch with Jellyfin Enhanced and your favorites will show up here."
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title="Your top rated"
        sub={`Everything you gave ${TOP_RATING} stars or more`}
        note={getCurrentTimeframe().description}
      >
        <PosterGrid>
          {top.map((r) => (
            <Poster
              key={`${r.kind}:${r.item.id}`}
              item={r.art}
              meta={[
                stars(r.rating),
                KIND_LABELS[r.kind],
                r.deleted ? "Since removed" : null,
              ]}
            />
          ))}
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
