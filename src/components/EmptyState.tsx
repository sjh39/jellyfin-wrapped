import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { neighbours, peekNavDirection, setNavDirection } from "@/lib/story";
import PageContainer from "./PageContainer";
import { Slide } from "./wrapped/Slide";

interface EmptyStateProps {
  title: string;
  message?: string;
  /** Old props, kept so existing callers compile. They are not used. */
  backgroundColor?: string;
  nextPage?: string;
  previousPage?: string;
}

// A slide with nothing to show. When the viewer is stepping through the story it is simply
// passed over, in the direction they were going. Opened from the menu, it says what is missing.
export default function EmptyState({
  title,
  message = "Nothing here yet. Watch a little more and check back.",
}: EmptyStateProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { next, previous } = neighbours(pathname);
  const direction = peekNavDirection();
  const target =
    direction === "next" ? next : direction === "previous" ? previous : null;

  useEffect(() => {
    if (!target) return;
    // Keep the direction so a run of empty slides is passed over in one go.
    setNavDirection(direction);
    void navigate(target, { replace: true });
  }, [target, direction, navigate]);

  if (target) return null;
  return (
    <PageContainer>
      <Slide single title={title} sub={message} />
    </PageContainer>
  );
}
