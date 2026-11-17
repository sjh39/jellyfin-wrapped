import { useQuery } from "@tanstack/react-query";
import { listLeaderboard } from "@/lib/queries";

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: listLeaderboard,
  });
}
