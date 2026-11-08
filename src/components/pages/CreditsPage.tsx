import { Container, Grid } from "@radix-ui/themes";
import { motion } from "framer-motion";
import { Subtitle, Title } from "../ui/styled";
import { itemVariants } from "@/lib/styled-variants";
import PageContainer from "../PageContainer";

const BACKGROUND = "var(--gray-8)";

const text = {
  fontSize: "1rem",
  lineHeight: 1.6,
  color: "var(--gray-12)",
  margin: "0.5rem 0 0",
};

// Attribution for the outside sources the backend uses to find posters of items
// that are no longer on the server. TMDB requires its logo and notice in an
// "About" or "Credits" section, less prominent than the app's own name.
export default function CreditsPage() {
  return (
    <PageContainer backgroundColor={BACKGROUND} previousPage="/punch-card">
      <Container size="2" p="4">
        <Grid gap="6">
          <div style={{ textAlign: "center" }}>
            <Title as={motion.h1} variants={itemVariants}>
              About and credits
            </Title>
            <Subtitle as={motion.p} variants={itemVariants}>
              Jellyfin Wrapped is a personal year-in-review for this Jellyfin
              server.
            </Subtitle>
          </div>

          <section>
            <img
              src={`${import.meta.env.BASE_URL}tmdb-logo.svg`}
              alt="The Movie Database (TMDB)"
              style={{ height: "18px", width: "auto" }}
            />
            <p style={text}>
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
          </section>

          <section>
            <p style={text}>
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
            <p style={text}>
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
          </section>

          <section>
            <p style={text}>
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
          </section>
        </Grid>
      </Container>
    </PageContainer>
  );
}
