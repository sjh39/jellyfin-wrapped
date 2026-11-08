import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useFavoriteActors } from "@/hooks/queries/useFavoriteActors";
import { LoadingSpinner } from "../LoadingSpinner";
import { ActorCard } from "./MoviesReviewPage/ActorCard";
import PageContainer from "../PageContainer";
import { BaseItemPerson } from "@jellyfin/sdk/lib/generated-client";
import { SimpleItemDto } from "@/lib/queries";
import { Slide } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";

const NEXT_PAGE = "/genres";

export default function FavoriteActorsPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: favoriteActors, isLoading, error } = useFavoriteActors();

  if (!isLoading && !error && favoriteActors && !favoriteActors.length) {
    return (
      <EmptyState
        title="No Favorite Actors Yet"
        backgroundColor="var(--orange-8)"
        nextPage={NEXT_PAGE}
        previousPage="/music-videos"
      />
    );
  }

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!favoriteActors?.length) {
    return null;
  }

  return (
    <PageContainer>
      <Slide
        title="Your favorite actors"
        sub="The performers who appeared most in what you watched"
      >
        <PosterGrid>
          {favoriteActors
            .slice(0, 20)
            .map(
              (actor: {
                name: string;
                count: number;
                details: BaseItemPerson;
                seenInMovies: SimpleItemDto[];
                seenInShows: SimpleItemDto[];
              }) => (
                <ActorCard
                  key={actor.name}
                  name={actor.name}
                  count={actor.count}
                  details={actor.details}
                  seenInMovies={actor.seenInMovies}
                  seenInShows={actor.seenInShows}
                />
              )
            )}
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
