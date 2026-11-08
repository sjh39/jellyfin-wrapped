import EmptyState from "../EmptyState";
import { format } from "date-fns";
import { useErrorBoundary } from "react-error-boundary";
import { useFirstWatched } from "@/hooks/queries/useFirstWatched";
import { LoadingSpinner } from "../LoadingSpinner";
import { MovieCard } from "./MoviesReviewPage/MovieCard";
import PageContainer from "../PageContainer";
import { Slide } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";

const NEXT_PAGE = "/movies";
const PREVIOUS_PAGE = "/TopTen";

export default function FirstWatchedPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: first, isLoading, error } = useFirstWatched();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!first) {
    return (
      <EmptyState
        title="Nothing Watched Yet"
        backgroundColor="var(--mint-8)"
        nextPage={NEXT_PAGE}
        previousPage={PREVIOUS_PAGE}
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title="Where it started"
        sub={`The first ${first.kind === "movie" ? "movie" : "show"} you watched`}
        note={`${format(first.watchedAt, "MMMM d, yyyy")}${
          first.kind === "show" && first.episodeName
            ? `, ${first.episodeName}`
            : ""
        }`}
      >
        <PosterGrid size="one">
          <MovieCard item={first.item} />
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
