import EmptyState from "../EmptyState";
import { useState, useMemo } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { useWatchedOnDate } from "@/hooks/queries/useWatchedOnDate";
import { LoadingSpinner } from "../LoadingSpinner";
import { MovieCard } from "./MoviesReviewPage/MovieCard";
import { getCachedHiddenIds, setCachedHiddenId } from "@/lib/cache";
import { getHolidayDates } from "@/lib/holiday-helpers";
import { subDays } from "date-fns";
import PageContainer from "../PageContainer";
import { Slide, Panel } from "@/components/wrapped/Slide";
import { PosterGrid } from "@/components/wrapped/Poster";

const NEXT_PAGE = "/minutes-per-day";

export default function HolidayReviewPage() {
  const { showBoundary } = useErrorBoundary();
  const [hiddenIds, setHiddenIds] = useState<string[]>(getCachedHiddenIds());

  const dates = useMemo(() => {
    const today = new Date();
    const holidays = getHolidayDates(today);
    return {
      christmas: holidays.christmas,
      christmasEve: subDays(holidays.christmas, 1),
      halloween: holidays.halloween,
      valentines: holidays.valentines,
    };
  }, []);

  const {
    data: christmas,
    isLoading: l1,
    error: e1,
  } = useWatchedOnDate(dates.christmas);
  const {
    data: christmasEve,
    isLoading: l2,
    error: e2,
  } = useWatchedOnDate(dates.christmasEve);
  const {
    data: halloween,
    isLoading: l3,
    error: e3,
  } = useWatchedOnDate(dates.halloween);
  const {
    data: valentines,
    isLoading: l4,
    error: e4,
  } = useWatchedOnDate(dates.valentines);

  const firstError = e1 || e2 || e3 || e4;
  if (firstError) {
    showBoundary(firstError);
  }

  if (l1 || l2 || l3 || l4) {
    return <LoadingSpinner />;
  }

  const filterHidden = (items: { id?: string }[] | undefined) =>
    items?.filter(
      (item: { id?: string }) => !hiddenIds.includes(item.id ?? "")
    ) ?? [];

  const christmasItems = filterHidden(christmas);
  const christmasEveItems = filterHidden(christmasEve);
  const halloweenItems = filterHidden(halloween);
  const valentinesItems = filterHidden(valentines);

  if (
    !christmasItems.length &&
    !christmasEveItems.length &&
    !halloweenItems.length &&
    !valentinesItems.length
  ) {
    return (
      <EmptyState
        title="No Holiday Viewing Data"
        backgroundColor="var(--grass-8)"
        nextPage={NEXT_PAGE}
        previousPage="/new-this-year"
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title="What you watched on holidays"
        sub="Your viewing activity during special occasions"
      >
        {christmasItems.length > 0 && (
          <Panel title="Christmas">
            <PosterGrid>
              {christmasItems.map((item: { id?: string }, index: number) => (
                <MovieCard
                  key={item.id ?? index}
                  item={item}
                  onHide={() => {
                    setCachedHiddenId(item.id ?? "");
                    setHiddenIds([...hiddenIds, item.id ?? ""]);
                  }}
                />
              ))}
            </PosterGrid>
          </Panel>
        )}
        {christmasEveItems.length > 0 && (
          <Panel title="Christmas Eve">
            <PosterGrid>
              {christmasEveItems.map((item: { id?: string }, index: number) => (
                <MovieCard
                  key={item.id ?? index}
                  item={item}
                  onHide={() => {
                    setCachedHiddenId(item.id ?? "");
                    setHiddenIds([...hiddenIds, item.id ?? ""]);
                  }}
                />
              ))}
            </PosterGrid>
          </Panel>
        )}
        {halloweenItems.length > 0 && (
          <Panel title="Halloween">
            <PosterGrid>
              {halloweenItems.map((item: { id?: string }, index: number) => (
                <MovieCard
                  key={item.id ?? index}
                  item={item}
                  onHide={() => {
                    setCachedHiddenId(item.id ?? "");
                    setHiddenIds([...hiddenIds, item.id ?? ""]);
                  }}
                />
              ))}
            </PosterGrid>
          </Panel>
        )}
        {valentinesItems.length > 0 && (
          <Panel title="Valentine's Day">
            <PosterGrid>
              {valentinesItems.map((item: { id?: string }, index: number) => (
                <MovieCard
                  key={item.id ?? index}
                  item={item}
                  onHide={() => {
                    setCachedHiddenId(item.id ?? "");
                    setHiddenIds([...hiddenIds, item.id ?? ""]);
                  }}
                />
              ))}
            </PosterGrid>
          </Panel>
        )}
      </Slide>
    </PageContainer>
  );
}
