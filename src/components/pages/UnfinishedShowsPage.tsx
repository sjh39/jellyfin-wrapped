import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useUnfinishedShows } from "@/hooks/queries/useUnfinishedShows";
import { LoadingSpinner } from "../LoadingSpinner";
import { format } from "date-fns";
import { UnfinishedShowDto } from "@/lib/queries";
import PageContainer from "../PageContainer";
import { Slide } from "../wrapped/Slide";
import { Poster, PosterGrid } from "../wrapped/Poster";

export default function UnfinishedShowsPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: shows, isLoading, error } = useUnfinishedShows();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!shows?.length) {
    return <EmptyState title="No unfinished shows" />;
  }

  return (
    <PageContainer>
      <Slide
        title="Unfinished shows"
        sub="Series you began watching but haven't completed yet"
      >
        <PosterGrid>
          {shows.slice(0, 12).map((show: UnfinishedShowDto) => (
            <Poster
              key={show.item.id}
              item={show.item}
              meta={[
                `${show.watchedEpisodes} of ${show.totalEpisodes} episodes`,
                `Last watched ${format(show.lastWatchedDate, "MMM d, yyyy")}`,
              ]}
            />
          ))}
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
