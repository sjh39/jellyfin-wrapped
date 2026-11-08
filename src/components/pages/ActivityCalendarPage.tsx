import { ResponsiveCalendar } from "@nivo/calendar";
import { useErrorBoundary } from "react-error-boundary";
import { subYears, format } from "date-fns";
import { useCalendar } from "@/hooks/queries/useCalendar";
import { LoadingSpinner } from "../LoadingSpinner";
import { useIsMobile } from "@/hooks/useIsMobile";
import PageContainer from "../PageContainer";
import { Slide } from "../wrapped/Slide";

// The calendar sits on the dark slide: a quiet empty day, then four brand colors for more.
const EMPTY_DAY = "#2b2f45";
const SCALE = ["#8fd9b6", "#f6b52b", "#f0522e", "#fcfbf7"];
const THEME = {
  text: { fill: "#fcfbf7", fontSize: 16, fontWeight: 700 },
  tooltip: { container: { color: "#101322", fontWeight: 700 } },
};

export default function ActivityCalendarPage() {
  const { showBoundary } = useErrorBoundary();
  const isMobile = useIsMobile();
  const { data, isLoading, error } = useCalendar();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const fromDate = format(subYears(new Date(), 1), "yyyy-MM-dd");
  const toDate = format(new Date(), "yyyy-MM-dd");

  return (
    <PageContainer>
      <Slide
        single
        title="Your year on a calendar"
        sub="Each square is a day. The brighter the color, the more you watched."
      >
        <div
          role="img"
          aria-label="A calendar of the last year, with each day colored by how much you watched"
          style={{ height: isMobile ? "46rem" : "min(62vh, 36rem)" }}
        >
          <ResponsiveCalendar
            data={data ?? []}
            from={fromDate}
            to={toDate}
            direction={isMobile ? "vertical" : "horizontal"}
            emptyColor={EMPTY_DAY}
            colors={SCALE}
            theme={THEME}
            margin={{ top: 40, right: 10, bottom: 10, left: 10 }}
            yearSpacing={40}
            monthBorderColor="#fcfbf7"
            monthBorderWidth={3}
            dayBorderWidth={2}
            dayBorderColor="#101322"
          />
        </div>
      </Slide>
    </PageContainer>
  );
}
