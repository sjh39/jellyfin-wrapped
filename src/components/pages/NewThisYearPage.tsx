import EmptyState from "../EmptyState";
import { format } from "date-fns";
import { useErrorBoundary } from "react-error-boundary";
import { useNewThisYear } from "@/hooks/queries/useNewThisYear";
import { LoadingSpinner } from "../LoadingSpinner";
import { NewLibraryItem } from "@/lib/queries";
import { getCurrentTimeframe } from "@/lib/timeframe";
import PageContainer from "../PageContainer";
import { Panel, Slide } from "../wrapped/Slide";
import { Poster, PosterGrid } from "../wrapped/Poster";

// Per section; a busy library can add hundreds of titles in a year.
const MAX_DISPLAY_ITEMS = 20;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

function AddedSection({
  heading,
  entries,
}: {
  heading: string;
  entries: NewLibraryItem[];
}) {
  if (!entries.length) return null;
  return (
    <Panel title={heading}>
      {entries.length > MAX_DISPLAY_ITEMS && (
        <p className="wp-note" style={{ marginBottom: "1rem" }}>
          Showing the first {MAX_DISPLAY_ITEMS} of {entries.length}
        </p>
      )}
      <PosterGrid>
        {entries.slice(0, MAX_DISPLAY_ITEMS).map((entry: NewLibraryItem) => (
          <Poster
            key={entry.item.id}
            item={entry.item}
            meta={[
              entry.item.productionYear
                ? String(entry.item.productionYear)
                : null,
              `Added ${format(entry.addedAt, "MMM d, yyyy")}`,
              entry.deleted ? "Since removed" : null,
            ]}
          />
        ))}
      </PosterGrid>
    </Panel>
  );
}

export default function NewThisYearPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: added, isLoading, error } = useNewThisYear();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const movies = added?.filter((entry) => entry.kind === "movie") ?? [];
  const shows = added?.filter((entry) => entry.kind === "show") ?? [];

  if (!movies.length && !shows.length) {
    return (
      <EmptyState
        title="Nothing new in the library"
        message="No movies or shows were added to Jellyfin in this time range."
      />
    );
  }

  return (
    <PageContainer>
      <Slide
        title="New this year"
        sub={`${plural(movies.length, "movie")} and ${plural(shows.length, "show")} joined your library`}
        note={`${getCurrentTimeframe().description}, in the order they arrived`}
      >
        <AddedSection heading="Movies" entries={movies} />
        <AddedSection heading="Shows" entries={shows} />
      </Slide>
    </PageContainer>
  );
}
