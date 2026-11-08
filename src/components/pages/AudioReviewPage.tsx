import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useAudio } from "@/hooks/queries/useAudio";
import { MovieCard } from "./MoviesReviewPage/MovieCard";
import { LoadingSpinner } from "../LoadingSpinner";
import { AudioPlayDto } from "@/lib/queries";
import PageContainer from "../PageContainer";
import { Slide } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";

const NEXT_PAGE = "/music-videos";
const MAX_DISPLAY_ITEMS = 20;

export default function AudioReviewPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: audios, isLoading, error } = useAudio();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const totalPlays =
    audios?.reduce((sum, audio) => sum + audio.playCount, 0) ?? 0;

  if (!audios?.length) {
    return (
      <EmptyState
        title="No Audio Listening History"
        backgroundColor="var(--red-8)"
        nextPage={NEXT_PAGE}
        previousPage="/shows"
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title={`You listened to ${audios.length} ${audios.length === 1 ? "song" : "songs"}`}
        sub={`${totalPlays} plays across your music listening history`}
        note={
          audios.length > MAX_DISPLAY_ITEMS
            ? `Showing your ${MAX_DISPLAY_ITEMS} most played songs`
            : undefined
        }
      >
        <PosterGrid>
          {audios.slice(0, MAX_DISPLAY_ITEMS).map((audio: AudioPlayDto) => (
            <MovieCard
              key={audio.item.id}
              item={audio.item}
              playCount={audio.playCount}
            />
          ))}
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
