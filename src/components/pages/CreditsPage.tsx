import PageContainer from "../PageContainer";
import { Slide } from "../wrapped/Slide";

// Attribution for the outside sources the backend uses to find posters of items that are
// no longer on the server. TMDB requires its logo and notice in an "About" or "Credits"
// section, less prominent than the app's own name.
export default function CreditsPage() {
  return (
    <PageContainer>
      <Slide
        title="About and credits"
        sub="Jellyfin Wrapped is a year in review for this Jellyfin server."
      >
        <div className="wp-prose">
          <p>
            <img
              src={`${import.meta.env.BASE_URL}tmdb-logo.svg`}
              alt="The Movie Database (TMDB)"
            />
            This product uses the TMDB API but is not endorsed or certified by
            TMDB. Posters for movies, shows and people that are no longer on
            this server may come from{" "}
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noreferrer"
            >
              The Movie Database (TMDB)
            </a>
            .
          </p>
          <p>
            Show posters may come from{" "}
            <a href="https://www.tvmaze.com" target="_blank" rel="noreferrer">
              TVmaze
            </a>
            , used under its{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-SA 4.0
            </a>{" "}
            license.
          </p>
          <p>
            Album covers may come from the{" "}
            <a
              href="https://coverartarchive.org"
              target="_blank"
              rel="noreferrer"
            >
              Cover Art Archive
            </a>{" "}
            (MusicBrainz and the Internet Archive).
          </p>
          <p>
            Based on{" "}
            <a
              href="https://github.com/johnpc/jellyfin-wrapped"
              target="_blank"
              rel="noreferrer"
            >
              Jellyfin Wrapped
            </a>{" "}
            by johnpc. Not affiliated with the Jellyfin project.
          </p>
        </div>
      </Slide>
    </PageContainer>
  );
}
