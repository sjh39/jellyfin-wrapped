import "@radix-ui/themes/styles.css";
import { ErrorBoundary } from "react-error-boundary";
import { Theme } from "@radix-ui/themes";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  Outlet,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SignInPage from "./components/pages/SignInPage";
import MoviesReviewPage from "./components/pages/MoviesReviewPage";
import ShowReviewPage from "./components/pages/ShowReviewPage";
import LiveTvReviewPage from "./components/pages/LiveTvReviewPage";
import AudioReviewPage from "./components/pages/AudioReviewPage";
import FavoriteActorsPage from "./components/pages/FavoriteActorsPage";
import OldestShowPage from "./components/pages/OldestShowPage";
import OldestMoviePage from "./components/pages/OldestMoviePage";
import MusicVideoPage from "./components/pages/MusicVideoPage";
import GenreReviewPage from "./components/pages/GenreReviewPage";
import HolidayReviewPage from "./components/pages/HolidayReviewPage";
import MinutesPlayedPerDayPage from "./components/pages/MinutesPlayedPerDayPage";
import DeviceStatsPage from "./components/pages/DeviceStatsPage";
import ShowOfTheMonthPage from "./components/pages/ShowOfTheMonthPage";
import UnfinishedShowsPage from "./components/pages/UnfinishedShowsPage";
import CriticallyAcclaimedPage from "./components/pages/CriticallyAcclaimedPage";
import TopTenPage from "./components/pages/TopTenPage";
import FirstWatchedPage from "./components/pages/FirstWatchedPage";
import NewThisYearPage from "./components/pages/NewThisYearPage";
import CreditsPage from "./components/pages/CreditsPage";
import { useEffect } from "react";
import ActivityCalendarPage from "./components/pages/ActivityCalendarPage";
import { ErrorScreen } from "./components/ErrorScreen";
import { LoadingPage } from "./components/pages/LoadingPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Layout component that wraps all routes
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [pathname]);

  return null;
}

function RootLayout() {
  return (
    <ErrorBoundary FallbackComponent={ErrorScreen}>
      <ScrollToTop />
      <QueryClientProvider client={queryClient}>
        <Theme hasBackground={false}>
          <Outlet />
        </Theme>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      children: [
        {
          path: "/",
          element: <SignInPage />,
        },
        {
          path: "/configure",
          element: <Navigate to="/" replace />,
        },
        {
          path: "/loading",
          element: <LoadingPage />,
        },
        {
          path: "/first-watched",
          element: <FirstWatchedPage />,
        },
        {
          path: "/movies",
          element: <MoviesReviewPage />,
        },
        {
          path: "/oldest-show",
          element: <OldestShowPage />,
        },
        {
          path: "/oldest-movie",
          element: <OldestMoviePage />,
        },
        {
          path: "/shows",
          element: <ShowReviewPage />,
        },
        {
          path: "/tv",
          element: <LiveTvReviewPage />,
        },
        {
          path: "/audio",
          element: <AudioReviewPage />,
        },
        {
          path: "/critically-acclaimed",
          element: <CriticallyAcclaimedPage />,
        },
        {
          path: "/credits",
          element: <CreditsPage />,
        },
        {
          path: "/new-this-year",
          element: <NewThisYearPage />,
        },
        {
          path: "/actors",
          element: <FavoriteActorsPage />,
        },
        {
          path: "/music-videos",
          element: <MusicVideoPage />,
        },
        {
          path: "/genres",
          element: <GenreReviewPage />,
        },
        {
          path: "/holidays",
          element: <HolidayReviewPage />,
        },
        {
          path: "/minutes-per-day",
          element: <MinutesPlayedPerDayPage />,
        },
        {
          path: "/show-of-the-month",
          element: <ShowOfTheMonthPage />,
        },
        {
          path: "/unfinished-shows",
          element: <UnfinishedShowsPage />,
        },
        {
          path: "/device-stats",
          element: <DeviceStatsPage />,
        },
        {
          path: "/punch-card",
          element: <ActivityCalendarPage />,
        },
        {
          path: "/TopTen",
          element: <TopTenPage />,
        },
      ],
    },
  ],
  {
    // Matches the build's BASE_PATH ("/" unless served under a sub-path).
    basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
  }
);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
