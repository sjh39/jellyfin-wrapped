import { useQuery } from "@tanstack/react-query";
import { listMyRatings } from "@/lib/queries";

export function useMyRatings() {
  return useQuery({
    queryKey: ["myRatings"],
    queryFn: listMyRatings,
  });
}
