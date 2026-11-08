import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useMovies } from "@/hooks/queries/useMovies";
import { useShows } from "@/hooks/queries/useShows";
import { LoadingSpinner } from "../LoadingSpinner";
import { ContentImage } from "../ContentImage";
import { getTopRatedContent, TopContent } from "@/lib/rating-helpers";
import PageContainer from "../PageContainer";
import { Slide } from "@/components/wrapped/Slide";
import { Rows, Row } from "@/components/wrapped/Rows";

const NEXT_PAGE = "/oldest-movie";

export default function CriticallyAcclaimedPage() {
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

  if (moviesError) showBoundary(moviesError);
  if (showsError) showBoundary(showsError);

  if (moviesLoading || showsLoading) {
    return <LoadingSpinner />;
  }

  const topContent = getTopRatedContent(movies ?? [], shows ?? []);

  if (!topContent.length) {
    return (
      <EmptyState
        title="No Critically Acclaimed Titles"
        backgroundColor="var(--cyan-8)"
        nextPage={NEXT_PAGE}
        previousPage="/tv"
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title="Critically acclaimed"
        sub="Highly-rated movies and shows from your viewing history"
      >
        <Rows>
          {topContent.map((content: TopContent) => (
            <Row
              key={content.item.id}
              art={<ContentImage item={content.item} />}
              title={content.item.name}
              meta={
                <>
                  {content.type === "movie" ? "Movie" : "TV show"}
                  <br />
                  Rated {content.item.communityRating?.toFixed(1)} / 10
                  {content.item.productionYear && (
                    <>
                      <br />
                      {content.item.productionYear}
                    </>
                  )}
                </>
              }
            />
          ))}
        </Rows>
      </Slide>
    </PageContainer>
  );
}
