import {
  type ReactNode,
  type TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CHAPTERS,
  FIRST_CHAPTER,
  SCREENING_MS,
  type NavDirection,
  type Tone,
  chapterIndex,
  clearNavDirection,
  getScreening,
  neighbours,
  setNavDirection,
  setScreening,
} from "@/lib/story";
import { ChapterMenu } from "./ChapterMenu";
import { Icon } from "./wrapped/Icon";

interface PageContainerProps {
  children: ReactNode;
  /** Override the slide's color (a slide normally takes the one set in lib/story.ts). */
  tone?: Tone;
  /** No progress bar, bar of controls or menu (the loading screen). */
  bare?: boolean;
  /** Old props, kept so pages that still pass them compile. They are not used. */
  backgroundColor?: string;
  nextPage?: string;
  previousPage?: string;
}

const SWIPE_DISTANCE_PX = 80;

// Every slide sits in this shell. It draws the progress bar and the controls, and it moves
// between slides from the buttons, the arrow keys or a remote, a swipe, or screening mode.
export default function PageContainer({
  children,
  tone,
  bare = false,
}: PageContainerProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const index = chapterIndex(pathname);
  const chapter = index >= 0 ? CHAPTERS[index] : undefined;
  const { next, previous } = neighbours(pathname);
  const activeTone: Tone = tone ?? chapter?.tone ?? "ink";

  const [menuOpen, setMenuOpen] = useState(false);
  const [screening, setScreeningState] = useState<boolean>(getScreening);
  const stageRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (path: string, direction: NavDirection) => {
      setNavDirection(direction);
      void navigate(path);
    },
    [navigate]
  );

  const changeScreening = useCallback((on: boolean) => {
    setScreening(on);
    setScreeningState(on);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  // The slide really shows (it was not passed over), so the "keep going" flag is spent.
  useEffect(() => {
    clearNavDirection();
  }, [pathname]);

  useEffect(() => {
    document.title = chapter
      ? `${chapter.name} | Jellyfin Wrapped`
      : "Jellyfin Wrapped";
  }, [chapter]);

  // A new slide takes focus so a screen reader announces it and keys act on the page.
  useEffect(() => {
    if (!bare) stageRef.current?.focus({ preventScroll: true });
  }, [pathname, bare]);

  // Arrow keys (or a remote's directional pad) move between slides. Space starts and stops
  // screening mode. Any other key stops it, so someone with a remote can take over.
  useEffect(() => {
    if (bare) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (menuOpen) return;
      const target = event.target as HTMLElement | null;
      const typing =
        target !== null &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          target.isContentEditable);
      if (typing) return;

      const onPage =
        target === document.body || target === stageRef.current || !target;
      if (event.key === " " && onPage) {
        event.preventDefault();
        changeScreening(!screening);
        return;
      }
      if (screening && event.key !== "Shift") changeScreening(false);

      if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        go(next, "next");
      } else if (event.key === "ArrowLeft" && previous) {
        event.preventDefault();
        go(previous, "previous");
      } else if (event.key === "m" || event.key === "M") {
        setMenuOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bare, menuOpen, screening, next, previous, go, changeScreening]);

  // Screening mode: move on by itself, for a TV or projector with nobody at the remote.
  useEffect(() => {
    if (bare || !screening || menuOpen || !next) return;
    const timer = window.setTimeout(() => go(next, "next"), SCREENING_MS);
    return () => window.clearTimeout(timer);
  }, [bare, screening, menuOpen, next, go, pathname]);

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || menuOpen) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * 2)
      return;
    if (dx < 0 && next) go(next, "next");
    else if (dx > 0 && previous) go(previous, "previous");
  };

  if (bare) {
    return (
      <div className={`wp-page tone-${activeTone}`}>
        <main className="wp-stage" aria-live="polite">
          {children}
        </main>
      </div>
    );
  }

  const total = CHAPTERS.length;
  return (
    <div
      className={`wp-page tone-${activeTone}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="wp-top">
        <div
          className="wp-segments"
          role="progressbar"
          aria-label="Slide"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={Math.max(index + 1, 1)}
        >
          {CHAPTERS.map((c, i) => (
            <i key={c.path} className={i <= index ? "on" : undefined} />
          ))}
        </div>
      </div>

      <main
        ref={stageRef}
        className="wp-stage"
        tabIndex={-1}
        aria-label={chapter?.name}
      >
        {children}
      </main>

      <nav className="wp-bar" aria-label="Slides">
        <span className="wp-count">
          {index + 1} of {total}
          {chapter && <span> · {chapter.name}</span>}
        </span>
        <div className="wp-controls">
          <button
            ref={menuButtonRef}
            type="button"
            className="wp-btn"
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" />
            <span className="wp-label">Menu</span>
          </button>
          <button
            type="button"
            className="wp-btn"
            aria-label="Previous slide"
            disabled={!previous}
            onClick={() => previous && go(previous, "previous")}
          >
            <Icon name="previous" />
          </button>
          <button
            type="button"
            className="wp-btn"
            aria-pressed={screening}
            aria-label={
              screening ? "Pause screening mode" : "Start screening mode"
            }
            onClick={() => changeScreening(!screening)}
          >
            <Icon name={screening ? "pause" : "play"} />
            <span className="wp-label">Screening</span>
          </button>
          {next ? (
            <button
              type="button"
              className="wp-btn"
              aria-label="Next slide"
              onClick={() => go(next, "next")}
            >
              <Icon name="next" />
            </button>
          ) : (
            <button
              type="button"
              className="wp-btn"
              onClick={() => go(FIRST_CHAPTER, "jump")}
            >
              <Icon name="restart" />
              <span className="wp-label">Start over</span>
            </button>
          )}
        </div>
      </nav>

      {menuOpen && (
        <ChapterMenu
          currentPath={pathname}
          screening={screening}
          onScreening={changeScreening}
          onGo={(path) => {
            setMenuOpen(false);
            go(path, "jump");
          }}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
