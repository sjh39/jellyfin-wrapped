import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useLeaderboard } from "@/hooks/queries/useLeaderboard";
import { LoadingSpinner } from "../LoadingSpinner";
import { hoursLabel, rankBy } from "@/lib/queries";
import { getCurrentTimeframe } from "@/lib/timeframe";
import PageContainer from "../PageContainer";
import { Slide } from "../wrapped/Slide";
import { Leaderboard } from "../wrapped/Leaderboard";

// Everyone on the server, ranked by hours of movies and of TV.
export default function WhoWatchedPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: users, isLoading, error } = useLeaderboard();

  if (error) showBoundary(error);
  if (isLoading) return <LoadingSpinner />;

  const movies = rankBy(users ?? [], (u) => u.movieSeconds);
  const shows = rankBy(users ?? [], (u) => u.showSeconds);

  if (!movies.length && !shows.length) {
    return <EmptyState title="Nobody watched anything" />;
  }

  return (
    <PageContainer>
      <Slide
        title="Who watched the most"
        sub="Everyone on the server, by hours watched"
        note={getCurrentTimeframe().description}
      >
        <div className="wp-cols">
          {movies.length > 0 && (
            <Leaderboard
              title="Movies"
              users={movies}
              label={(u) => hoursLabel(u.movieSeconds)}
            />
          )}
          {shows.length > 0 && (
            <Leaderboard
              title="TV"
              users={shows}
              label={(u) => hoursLabel(u.showSeconds)}
            />
          )}
        </div>
      </Slide>
    </PageContainer>
  );
}
