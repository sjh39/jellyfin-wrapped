import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useLiveTvChannels } from "@/hooks/queries/useLiveTvChannels";
import { LoadingSpinner } from "../LoadingSpinner";
import { formatDuration } from "@/lib/utils";
import PageContainer from "../PageContainer";
import { Slide } from "../wrapped/Slide";
import { Row, Rows } from "../wrapped/Rows";

export default function LiveTvReviewPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: channels, isLoading, error } = useLiveTvChannels();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const sortedChannels = [...(channels ?? [])].sort(
    (a: { duration: number }, b: { duration: number }) =>
      b.duration - a.duration
  );

  if (!sortedChannels.length) {
    return <EmptyState title="No live TV activity" />;
  }

  return (
    <PageContainer>
      <Slide
        title={`You watched ${sortedChannels.length} live TV ${sortedChannels.length === 1 ? "channel" : "channels"}`}
        sub="Your live television viewing across different channels"
      >
        <Rows>
          {sortedChannels.map(
            (
              channel: { channelName: string; duration: number },
              index: number
            ) => (
              <Row
                key={channel.channelName}
                n={index + 1}
                title={channel.channelName}
                meta={`Watch time ${formatDuration(channel.duration)}`}
              />
            )
          )}
        </Rows>
      </Slide>
    </PageContainer>
  );
}
