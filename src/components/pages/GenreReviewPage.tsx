import EmptyState from "../EmptyState";
import { useState } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { useMovies } from "@/hooks/queries/useMovies";
import { useShows } from "@/hooks/queries/useShows";
import { LoadingSpinner } from "../LoadingSpinner";
import { MovieCard } from "./MoviesReviewPage/MovieCard";
import { getCachedHiddenIds, setCachedHiddenId } from "@/lib/cache";
import { getTopGenre } from "@/lib/genre-helpers";
import PageContainer from "../PageContainer";
import { Slide, Panel } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";
import { Rows, Row } from "@/components/wrapped/Rows";

const NEXT_PAGE = "/tv";

export default function GenreReviewPage() {
  const { showBoundary } = useErrorBoundary();
  const {
    data: movies,
    isLoading: moviesLoading,
    error: moviesError,
  } = useMovies();
  const {
    data: shows,
    isLoading: showsLoading,
    error: showsError,
  } = useShows();
  const [hiddenIds, setHiddenIds] = useState<string[]>(getCachedHiddenIds());

  if (moviesError) showBoundary(moviesError);
  if (showsError) showBoundary(showsError);

  if (moviesLoading || showsLoading) {
    return <LoadingSpinner />;
  }

  const visibleMovies =
    movies?.filter(
      (movie: { id?: string }) => !hiddenIds.includes(movie.id ?? "")
    ) ?? [];

  const visibleShows =
    shows
      ?.map((show: { item: { id?: string } }) => show.item)
      .filter((show: { id?: string }) => !hiddenIds.includes(show.id ?? "")) ??
    [];

  const topGenreData = getTopGenre(visibleMovies, visibleShows);

  if (!topGenreData) {
    return (
      <EmptyState
        title="No Genre Data"
        backgroundColor="var(--pink-8)"
        nextPage={NEXT_PAGE}
        previousPage="/actors"
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title={`Your top genre: ${topGenreData.genre}`}
        sub="The genre you watched most this year"
        note={`${topGenreData.count} items watched`}
      >
        <PosterGrid>
          {topGenreData.items
            .slice(0, 20)
            .map((item: { id?: string }, index: number) => (
              <MovieCard
                key={item.id ?? index}
                item={item}
                onHide={() => {
                  setCachedHiddenId(item.id ?? "");
                  setHiddenIds([...hiddenIds, item.id ?? ""]);
                }}
              />
            ))}
        </PosterGrid>
        {topGenreData.honorableMentions.length > 0 && (
          <Panel title="Honorable mentions">
            <Rows>
              {topGenreData.honorableMentions.map((mention) => (
                <Row
                  key={mention.genre}
                  title={mention.genre}
                  meta={`${mention.count} items`}
                />
              ))}
            </Rows>
          </Panel>
        )}
      </Slide>
    </PageContainer>
  );
}
