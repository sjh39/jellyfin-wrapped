import { useEffect, useState } from "react";
import { getImageUrlById } from "@/lib/queries";

// The poster for an item, once it has loaded. Undefined until then, or if there is none.
export function useImageUrl(id: string | undefined): string | undefined {
  const [loaded, setLoaded] = useState<{ id: string; url: string }>();

  useEffect(() => {
    if (!id) return;
    let live = true;
    getImageUrlById(id)
      .then((url) => {
        if (live && url) setLoaded({ id, url });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id]);

  return loaded && loaded.id === id ? loaded.url : undefined;
}
