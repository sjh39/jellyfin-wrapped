import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useMonthlyShowStats } from "@/hooks/queries/useMonthlyShowStats";
import { LoadingSpinner } from "../LoadingSpinner";
import { format } from "date-fns";
import { formatWatchTime } from "@/lib/time-helpers";
import PageContainer from "../PageContainer";
import { Slide } from "../wrapped/Slide";
import { Poster, PosterGrid } from "../wrapped/Poster";

export default function ShowOfTheMonthPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: stats, isLoading, error } = useMonthlyShowStats();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!stats?.length) {
    return <EmptyState title="No show of the month data" />;
  }

  return (
    <PageContainer>
      <Slide
        title="Your top show each month"
        sub="The show you watched the most in each month of the year"
      >
        <PosterGrid>
          {stats.map((stat) => (
            <Poster
              key={stat.month.toISOString()}
              item={stat.topShow.item}
              meta={[
                format(stat.month, "MMMM yyyy"),
                formatWatchTime(stat.topShow.watchTimeMinutes),
              ]}
            />
          ))}
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
