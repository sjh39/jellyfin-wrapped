import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useMinutesPlayedPerDay } from "@/hooks/queries/useMinutesPlayedPerDay";
import { useViewingPatterns } from "@/hooks/queries/useViewingPatterns";
import { LoadingSpinner } from "../LoadingSpinner";
import { LineChart } from "../charts/LineChart";
import { BarChart } from "../charts/BarChart";
import PageContainer from "../PageContainer";
import { Panel, Slide } from "../wrapped/Slide";
import { Stat } from "../wrapped/Stat";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MinutesPlayedPerDayPage() {
  const { showBoundary } = useErrorBoundary();
  const {
    data: playbackData,
    isLoading: l1,
    error: e1,
  } = useMinutesPlayedPerDay();
  const {
    data: viewingPatterns,
    isLoading: l2,
    error: e2,
  } = useViewingPatterns();

  const firstError = e1 || e2;
  if (firstError) {
    showBoundary(firstError);
  }

  if (l1 || l2) {
    return <LoadingSpinner />;
  }

  if (!playbackData || !viewingPatterns) {
    return <EmptyState title="No daily viewing data" />;
  }

  const sortedData = [...playbackData].sort(
    (a: { date: string }, b: { date: string }) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const activityData = sortedData.map((d: { minutes: number }, i: number) => ({
    x: i,
    y: d.minutes,
  }));

  const timeOfDayData = viewingPatterns.timeOfDay.map(
    (d: { hour: number; minutes: number }) => ({ x: d.hour, y: d.minutes })
  );

  const dayOfWeekData = viewingPatterns.dayOfWeek.map(
    (d: { day: number; minutes: number }) => ({
      label: dayNames[d.day] ?? String(d.day),
      value: d.minutes,
    })
  );

  const totalMinutes = playbackData.reduce(
    (sum: number, d: { minutes: number }) => sum + d.minutes,
    0
  );
  const totalHours = Math.floor(totalMinutes / 60);

  return (
    <PageContainer>
      <Slide
        title="Your viewing activity"
        sub="See when you watch the most throughout the day and week"
      >
        <Stat value={totalHours.toLocaleString()} label="hours watched" />
        <Panel title="Day of week">
          <BarChart
            data={dayOfWeekData}
            yLabel="Minutes"
            label="Minutes watched on each day of the week"
          />
        </Panel>
        <Panel title="Time of day">
          <LineChart
            data={timeOfDayData}
            xLabel="Hour of the day"
            yLabel="Minutes"
            label="Minutes watched at each hour of the day"
          />
        </Panel>
        <Panel title="Day by day">
          <LineChart
            data={activityData}
            xLabel="Days"
            yLabel="Minutes"
            label="Minutes watched on each day"
          />
        </Panel>
      </Slide>
    </PageContainer>
  );
}
