import { useTopTen } from "@/hooks/queries/useTopTen";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ContentImage } from "@/components/ContentImage";
import { formatWatchTime } from "@/lib/time-helpers";
import { SimpleItemDto } from "@/lib/queries";
import PageContainer from "@/components/PageContainer";
import EmptyState from "@/components/EmptyState";
import { Slide, Panel } from "@/components/wrapped/Slide";
import { Rows, Row } from "@/components/wrapped/Rows";

export const TopTen = () => {
  const year = new Date().getFullYear();
  const { data, isLoading, error } = useTopTen();

  if (isLoading) return <LoadingSpinner />;
  if (error) throw error;
  if (!data) return null;
  if (!data.movies.length && !data.shows.length) {
    return (
      <EmptyState
        title="Nothing to rank yet"
        message="Watch a few things and your top 10 will show up here."
      />
    );
  }

  return (
    <PageContainer>
      <Slide single title={`Your top 10 of ${year}`}>
        <div className="wp-cols">
          {data.movies.length > 0 && (
            <Panel title="Top movies">
              <Rows>
                {data.movies.map((movie: SimpleItemDto, index: number) => (
                  <Row
                    key={movie.id}
                    n={index + 1}
                    art={<ContentImage item={movie} />}
                    title={movie.name}
                    meta={
                      movie.durationSeconds
                        ? formatWatchTime(movie.durationSeconds / 60)
                        : undefined
                    }
                  />
                ))}
              </Rows>
            </Panel>
          )}
          {data.shows.length > 0 && (
            <Panel title="Top shows">
              <Rows>
                {data.shows.map(
                  (
                    show: {
                      item: SimpleItemDto;
                      episodeCount: number;
                      playbackTime: number;
                    },
                    index: number
                  ) => (
                    <Row
                      key={show.item.id}
                      n={index + 1}
                      art={<ContentImage item={show.item} />}
                      title={show.item.name}
                      meta={`${show.episodeCount} ${show.episodeCount === 1 ? "episode" : "episodes"}, ${formatWatchTime(show.playbackTime / 60)}`}
                    />
                  )
                )}
              </Rows>
            </Panel>
          )}
        </div>
      </Slide>
    </PageContainer>
  );
};
