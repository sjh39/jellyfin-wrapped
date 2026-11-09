import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMovies } from "../../hooks/queries/useMovies";
import { useShows } from "../../hooks/queries/useShows";
import { useFavoriteActors } from "../../hooks/queries/useFavoriteActors";
import { useAudio } from "../../hooks/queries/useAudio";
import { useLiveTvChannels } from "../../hooks/queries/useLiveTvChannels";
import { useUnfinishedShows } from "../../hooks/queries/useUnfinishedShows";
import { useMusicVideos } from "../../hooks/queries/useMusicVideos";
import { useViewingPatterns } from "../../hooks/queries/useViewingPatterns";
import { usePunchCard } from "../../hooks/queries/usePunchCard";
import { useMonthlyShowStats } from "../../hooks/queries/useMonthlyShowStats";
import { useMinutesPlayedPerDay } from "../../hooks/queries/useMinutesPlayedPerDay";
import { useDeviceStats } from "../../hooks/queries/useDeviceStats";
import { useCalendar } from "../../hooks/queries/useCalendar";
import { useNewThisYear } from "../../hooks/queries/useNewThisYear";
import { useMyRatings } from "../../hooks/queries/useMyRatings";
import PageContainer from "../PageContainer";
import { setNavDirection } from "@/lib/story";

// Pause on 100% so the bar is seen finishing before the next page opens.
const FINISH_DELAY_MS = 600;

export function LoadingPage() {
  const navigate = useNavigate();

  // Everything the pages show is loaded here, so later pages open without waiting.
  // Each step is one query; the bar is the share of them that have finished.
  const steps = [
    { message: "Counting your movies...", query: useMovies() },
    { message: "Counting your shows...", query: useShows() },
    { message: "Finding your favorite actors...", query: useFavoriteActors() },
    { message: "Listening to your music...", query: useAudio() },
    { message: "Checking live TV...", query: useLiveTvChannels() },
    { message: "Finding unfinished shows...", query: useUnfinishedShows() },
    { message: "Rolling the music videos...", query: useMusicVideos() },
    {
      message: "Reading your viewing patterns...",
      query: useViewingPatterns(),
    },
    { message: "Punching your punch card...", query: usePunchCard() },
    { message: "Tallying up the episodes...", query: useMonthlyShowStats() },
    {
      message: "Adding up your watch time...",
      query: useMinutesPlayedPerDay(),
    },
    { message: "Checking your devices...", query: useDeviceStats() },
    { message: "Filling in the calendar...", query: useCalendar() },
    {
      message: "Checking what's new in the library...",
      query: useNewThisYear(),
    },
    { message: "Reading your ratings...", query: useMyRatings() },
  ];

  // A query that failed is finished too; its own page shows the error.
  const finished = steps.filter((step) => !step.query.isPending).length;
  const progress = Math.round((finished / steps.length) * 100);
  const allLoaded = finished === steps.length;
  const current = steps.find((step) => step.query.isPending);

  useEffect(() => {
    if (!allLoaded) return;
    const timer = setTimeout(() => {
      setNavDirection("next");
      void navigate("/TopTen");
    }, FINISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [allLoaded, navigate]);

  return (
    <PageContainer bare tone="cobalt">
      <div
        className="wp-slide wp-single"
        style={{ minHeight: "70vh", alignContent: "center" }}
      >
        <h1 className="wp-title" role="status">
          {current?.message ?? "All done!"}
        </h1>
        <div
          className="wp-meter"
          role="progressbar"
          aria-label="Loading your year"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <i style={{ width: `${progress}%` }} />
        </div>
        <p className="wp-sub">{progress}%</p>
      </div>
    </PageContainer>
  );
}
