import EmptyState from "../EmptyState";
import { useState } from "react";

import { useErrorBoundary } from "react-error-boundary";
import { useShows } from "@/hooks/queries/useShows";
import { MovieCard } from "./MoviesReviewPage/MovieCard";
import { LoadingSpinner } from "../LoadingSpinner";
import { getCachedHiddenIds, setCachedHiddenId } from "@/lib/cache";
import PageContainer from "../PageContainer";
import { Slide } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";

const NEXT_PAGE = "/audio";

export default function ShowReviewPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: shows, isLoading, error } = useShows();
  const [hiddenIds, setHiddenIds] = useState<string[]>(getCachedHiddenIds());

  const visibleShows =
    shows?.filter(
      (show: { item: { id?: string } }) =>
        !hiddenIds.includes(show.item.id ?? "")
    ) ?? [];

  if (!isLoading && !error && shows && !visibleShows.length) {
    return (
      <EmptyState
        title="No Shows Watched"
        backgroundColor="var(--yellow-8)"
        nextPage={NEXT_PAGE}
        previousPage="/movies"
      />
    );
  }

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!visibleShows.length) {
    return null;
  }

  return (
    <PageContainer>
      <Slide
        title={`You watched ${visibleShows.length} ${visibleShows.length === 1 ? "show" : "shows"}`}
        sub="Your most-watched TV shows"
      >
        <PosterGrid>
          {visibleShows
            .slice(0, 20)
            .map(
              (show: {
                item: { id?: string };
                episodeCount: number;
                playbackTime: number;
              }) => (
                <MovieCard
                  key={show.item.id}
                  item={show.item}
                  episodeCount={show.episodeCount}
                  playbackTime={show.playbackTime}
                  onHide={() => {
                    setCachedHiddenId(show.item.id ?? "");
                    setHiddenIds([...hiddenIds, show.item.id ?? ""]);
                  }}
                />
              )
            )}
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
