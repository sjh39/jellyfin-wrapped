import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useShows } from "@/hooks/queries/useShows";
import { LoadingSpinner } from "../LoadingSpinner";
import { MovieCard } from "./MoviesReviewPage/MovieCard";
import { SimpleItemDto } from "@/lib/queries";
import PageContainer from "../PageContainer";
import { Slide } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";

const NEXT_PAGE = "/new-this-year";

export default function OldestShowPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: shows, isLoading, error } = useShows();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const sortedShows = [...(shows ?? [])].sort(
    (a: { item: SimpleItemDto }, b: { item: SimpleItemDto }) => {
      const aDate = new Date(a.item.date ?? new Date());
      const bDate = new Date(b.item.date ?? new Date());
      return aDate.getTime() - bDate.getTime();
    }
  );

  const show = sortedShows[0];

  if (!show) {
    return (
      <EmptyState
        title="No Show History"
        backgroundColor="var(--lime-8)"
        nextPage={NEXT_PAGE}
        previousPage="/oldest-movie"
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title="Oldest show you watched"
        sub="The most classic series you enjoyed"
        note={`Released in ${show.item.productionYear}`}
      >
        <PosterGrid size="one">
          <MovieCard
            item={show.item}
            episodeCount={show.episodeCount}
            playbackTime={show.playbackTime}
          />
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
