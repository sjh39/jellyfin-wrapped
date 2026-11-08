import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useMovies } from "@/hooks/queries/useMovies";
import { LoadingSpinner } from "../LoadingSpinner";
import { MovieCard } from "./MoviesReviewPage/MovieCard";
import PageContainer from "../PageContainer";
import { Slide } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";

const NEXT_PAGE = "/oldest-show";

export default function OldestMoviePage() {
  const { showBoundary } = useErrorBoundary();
  const { data: movies, isLoading, error } = useMovies();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const sortedMovies = [...(movies ?? [])].sort(
    (a: { date?: string | null }, b: { date?: string | null }) => {
      const aDate = new Date(a.date ?? new Date());
      const bDate = new Date(b.date ?? new Date());
      return aDate.getTime() - bDate.getTime();
    }
  );

  const movie = sortedMovies[0];

  if (!movie) {
    return (
      <EmptyState
        title="No Movie History"
        backgroundColor="var(--teal-8)"
        nextPage={NEXT_PAGE}
        previousPage="/critically-acclaimed"
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title="Oldest movie you watched"
        sub="The most vintage film in your viewing history"
        note={`Released in ${movie.productionYear}`}
      >
        <PosterGrid size="one">
          <MovieCard item={movie} />
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
