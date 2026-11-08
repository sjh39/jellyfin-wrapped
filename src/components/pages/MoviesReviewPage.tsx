import EmptyState from "../EmptyState";
import { useState } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { useMovies } from "@/hooks/queries/useMovies";
import { MovieCard } from "./MoviesReviewPage/MovieCard";
import PageContainer from "../PageContainer";
import { LoadingSpinner } from "../LoadingSpinner";
import { getCachedHiddenIds, setCachedHiddenId } from "@/lib/cache";
import { Slide } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";

const NEXT_PAGE = "/shows";

export default function MoviesReviewPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: movies, isLoading, error } = useMovies();
  const [hiddenIds, setHiddenIds] = useState<string[]>(getCachedHiddenIds());

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const visibleMovies =
    movies?.filter(
      (movie: { id?: string }) => !hiddenIds.includes(movie.id ?? "")
    ) ?? [];

  if (!visibleMovies.length) {
    return (
      <EmptyState
        title="No Movies Watched"
        backgroundColor="var(--purple-8)"
        nextPage={NEXT_PAGE}
        previousPage="/first-watched"
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title={`You watched ${visibleMovies.length} ${visibleMovies.length === 1 ? "movie" : "movies"}`}
        sub="Your complete movie viewing history"
      >
        <PosterGrid>
          {visibleMovies.map(
            (movie: { id?: string; name?: string | null }, index: number) => (
              <MovieCard
                key={movie.id ?? index}
                item={movie}
                onHide={() => {
                  setCachedHiddenId(movie.id ?? "");
                  setHiddenIds([...hiddenIds, movie.id ?? ""]);
                }}
              />
            )
          )}
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
