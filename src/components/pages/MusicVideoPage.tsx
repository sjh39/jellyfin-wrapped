import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useMusicVideos } from "@/hooks/queries/useMusicVideos";
import { MovieCard } from "./MoviesReviewPage/MovieCard";
import { LoadingSpinner } from "../LoadingSpinner";
import PageContainer from "../PageContainer";
import { Slide } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";

const NEXT_PAGE = "/actors";

export default function MusicVideoPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: musicVideos, isLoading, error } = useMusicVideos();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!musicVideos?.length) {
    return (
      <EmptyState
        title="No Music Videos Watched"
        backgroundColor="var(--red-8)"
        nextPage={NEXT_PAGE}
        previousPage="/audio"
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title={`You watched ${musicVideos.length} music ${musicVideos.length === 1 ? "video" : "videos"}`}
        sub="Your music video viewing collection"
      >
        <PosterGrid>
          {musicVideos.slice(0, 20).map((musicVideo: { id?: string }) => (
            <MovieCard key={musicVideo.id} item={musicVideo} />
          ))}
        </PosterGrid>
      </Slide>
    </PageContainer>
  );
}
