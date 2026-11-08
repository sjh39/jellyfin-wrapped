import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatTimeframeDescription,
  generateTimeframeOptions,
  getCurrentTimeframe,
  setCurrentTimeframe,
} from "@/lib/timeframe";
import { CHAPTERS } from "@/lib/story";
import { signOut } from "@/lib/jellyfin-api";
import { Icon } from "./wrapped/Icon";

interface ChapterMenuProps {
  currentPath: string;
  screening: boolean;
  onScreening: (on: boolean) => void;
  onGo: (path: string) => void;
  onClose: () => void;
}

const FOCUSABLE = "button:not([disabled]), select, a[href], [tabindex='0']";

// The side sheet: jump to any slide, pick the time range, turn on screening mode, sign out.
export function ChapterMenu({
  currentPath,
  screening,
  onScreening,
  onGo,
  onClose,
}: ChapterMenuProps) {
  const queryClient = useQueryClient();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [timeframes] = useState(generateTimeframeOptions);
  const [selectedId, setSelectedId] = useState(() => getCurrentTimeframe().id);

  // Open with focus inside the sheet.
  useEffect(() => {
    sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !sheetRef.current) return;
    // Keep Tab inside the sheet while it is open.
    const items = Array.from(
      sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const changeTimeframe = (id: string) => {
    const option = timeframes.find((t) => t.id === id);
    if (!option) return;
    setSelectedId(id);
    setCurrentTimeframe(option);
    // Every query reads the selected timeframe when it runs, so resetting them re-runs the
    // ones on screen now and the rest the next time their slide opens.
    void queryClient.resetQueries();
  };

  return (
    <>
      <div className="wp-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className="wp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onKeyDown={onKeyDown}
      >
        <div className="wp-sheet-head">
          <h2>Jellyfin Wrapped</h2>
          <button
            type="button"
            className="wp-btn"
            aria-label="Close menu"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <label className="wp-field">
          <span>Time range</span>
          <select
            className="wp-select"
            value={selectedId}
            onChange={(event) => changeTimeframe(event.target.value)}
          >
            {timeframes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({formatTimeframeDescription(t)})
              </option>
            ))}
          </select>
        </label>

        <div className="wp-field">
          <span>Screening mode</span>
          <button
            type="button"
            className="wp-btn"
            aria-pressed={screening}
            onClick={() => onScreening(!screening)}
          >
            <Icon name={screening ? "pause" : "play"} />
            {screening ? "On" : "Off"}
          </button>
          <small>
            Moves to the next slide every few seconds. Press any key to stop.
          </small>
        </div>

        <nav aria-label="All slides">
          <ol className="wp-chapters">
            {CHAPTERS.map((chapter, i) => (
              <li key={chapter.path}>
                <button
                  type="button"
                  className="wp-chap"
                  aria-current={
                    chapter.path === currentPath ? "page" : undefined
                  }
                  onClick={() => onGo(chapter.path)}
                >
                  <b>{i + 1}</b>
                  {chapter.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <button type="button" className="wp-btn" onClick={signOut}>
          Sign out
        </button>
      </div>
    </>
  );
}
