import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useMyRatings } from "@/hooks/queries/useMyRatings";
import { LoadingSpinner } from "../LoadingSpinner";
import { MIN_RATINGS, stars } from "@/lib/queries";
import PageContainer from "../PageContainer";
import { Slide } from "../wrapped/Slide";
import { Rows, Row } from "../wrapped/Rows";
import { Thumb } from "../wrapped/Poster";

// A gap of a full star (2 points on the 10-point community scale) or more.
const MIN_GAP = 2;
const MAX_DISPLAY_ITEMS = 5;

// Where the viewer's stars and the community rating disagree most.
export default function VsCriticsPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: ratings, isLoading, error } = useMyRatings();

  if (error) showBoundary(error);
  if (isLoading) return <LoadingSpinner />;

  const gaps = (ratings ?? [])
    .filter((r) => r.item.communityRating)
    .map((r) => ({ ...r, gap: r.rating * 2 - (r.item.communityRating ?? 0) }))
    .filter((r) => Math.abs(r.gap) >= MIN_GAP)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, MAX_DISPLAY_ITEMS);

  if ((ratings ?? []).length < MIN_RATINGS || !gaps.length) {
    return (
      <EmptyState
        title="You agree with everyone"
        message="None of your ratings were far from the community's."
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title="You vs everyone"
        sub="Where your rating and the crowd's were furthest apart"
      >
        <Rows>
          {gaps.map((r) => (
            <Row
              key={`${r.kind}:${r.item.id}`}
              art={<Thumb item={r.art} />}
              title={r.item.name}
              meta={
                <>
                  You {stars(r.rating)}
                  <br />
                  Everyone {r.item.communityRating?.toFixed(1)} / 10
                  <br />
                  {r.gap > 0 ? "You liked it more" : "You liked it less"}
                </>
              }
            />
          ))}
        </Rows>
      </Slide>
    </PageContainer>
  );
}
