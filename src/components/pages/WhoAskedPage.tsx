import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useLeaderboard } from "@/hooks/queries/useLeaderboard";
import { LoadingSpinner } from "../LoadingSpinner";
import { rankBy } from "@/lib/queries";
import { getCurrentTimeframe } from "@/lib/timeframe";
import PageContainer from "../PageContainer";
import { Slide } from "../wrapped/Slide";
import { Leaderboard } from "../wrapped/Leaderboard";

const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

// Everyone on the server, ranked by Seerr requests and by items downloaded to a device.
export default function WhoAskedPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: users, isLoading, error } = useLeaderboard();

  if (error) showBoundary(error);
  if (isLoading) return <LoadingSpinner />;

  const requests = rankBy(users ?? [], (u) => u.requests);
  const downloads = rankBy(users ?? [], (u) => u.downloads);

  if (!requests.length && !downloads.length) {
    return <EmptyState title="No requests or downloads" />;
  }

  return (
    <PageContainer>
      <Slide
        title="Who asked for more"
        sub="Everyone on the server, by requests made and things downloaded"
        note={getCurrentTimeframe().description}
      >
        <div className="wp-cols">
          {requests.length > 0 && (
            <Leaderboard
              title="Requests"
              users={requests}
              label={(u) => count(u.requests, "request", "requests")}
            />
          )}
          {downloads.length > 0 && (
            <Leaderboard
              title="Downloads"
              users={downloads}
              label={(u) => count(u.downloads, "download", "downloads")}
            />
          )}
        </div>
      </Slide>
    </PageContainer>
  );
}
