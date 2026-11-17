import type { LeaderboardUser } from "@/lib/queries";
import { Panel } from "./Slide";
import { Rows, Row } from "./Rows";

const MAX_ROWS = 10;

// One ranked list of users for the whole-server slides. The viewer's own row says so.
export function Leaderboard({
  title,
  users,
  label,
}: {
  title: string;
  users: LeaderboardUser[];
  label: (u: LeaderboardUser) => string;
}) {
  return (
    <Panel title={title}>
      <Rows>
        {users.slice(0, MAX_ROWS).map((u, i) => (
          <Row
            key={u.name}
            n={i + 1}
            title={u.you ? `${u.name} (you)` : u.name}
            meta={label(u)}
          />
        ))}
      </Rows>
    </Panel>
  );
}
