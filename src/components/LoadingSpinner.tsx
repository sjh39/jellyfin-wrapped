interface LoadingSpinnerProps {
  /** Old prop, kept so existing callers compile. It is not used. */
  backgroundColor?: string;
}

export function LoadingSpinner(props: LoadingSpinnerProps) {
  void props;
  return (
    <div
      className="wp-page wp-center tone-ink"
      role="status"
      aria-label="Loading"
    >
      <div className="wp-loading" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
