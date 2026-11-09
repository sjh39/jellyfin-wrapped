import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useMyRatings } from "@/hooks/queries/useMyRatings";
import { LoadingSpinner } from "../LoadingSpinner";
import { MIN_RATINGS } from "@/lib/queries";
import { getCurrentTimeframe } from "@/lib/timeframe";
import PageContainer from "../PageContainer";
import { Panel, Slide } from "../wrapped/Slide";
import { Stat } from "../wrapped/Stat";
import { BarChart } from "../charts/BarChart";

// Half-star steps from ½ to 5.
const STEPS = Array.from({ length: 10 }, (_, i) => (i + 1) / 2);
const stepLabel = (step: number) =>
  step < 1 ? "½" : `${Math.floor(step)}${step % 1 ? "½" : ""}`;

const verdict = (average: number): string =>
  average >= 4.2
    ? "Easy to please"
    : average <= 2.8
      ? "Tough crowd"
      : "Fair judge";

// How the viewer rates: their average and how their stars spread out.
export default function CriticProfilePage() {
  const { showBoundary } = useErrorBoundary();
  const { data: ratings, isLoading, error } = useMyRatings();

  if (error) showBoundary(error);
  if (isLoading) return <LoadingSpinner />;

  const all = ratings ?? [];
  if (all.length < MIN_RATINGS) {
    return (
      <EmptyState
        title="Not enough ratings"
        message={`Rate at least ${MIN_RATINGS} things with Jellyfin Enhanced to see what kind of critic you are.`}
      />
    );
  }

  const average = all.reduce((sum, r) => sum + r.rating, 0) / all.length;
  const spread = STEPS.map((step) => ({
    label: stepLabel(step),
    value: all.filter((r) => r.rating === step).length,
  }));

  return (
    <PageContainer>
      <Slide
        title="You, the critic"
        sub={`${all.length} ratings`}
        note={getCurrentTimeframe().description}
      >
        <Stat value={`${average.toFixed(1)}★`} label={verdict(average)} />
        <Panel title="Your stars">
          <BarChart
            data={spread}
            yLabel="Ratings"
            label="How many ratings you gave at each star level"
          />
        </Panel>
      </Slide>
    </PageContainer>
  );
}
