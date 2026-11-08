import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  authenticateByAuthToken,
  authenticateByUserName,
  getEnvVar,
  resumeSession,
} from "@/lib/jellyfin-api";
import {
  JELLYFIN_AUTH_TOKEN_CACHE_KEY,
  JELLYFIN_SERVER_URL_CACHE_KEY,
  JELLYFIN_USERNAME_CACHE_KEY,
  getCacheValue,
  setCacheValue,
} from "@/lib/cache";
import { setNavDirection } from "@/lib/story";

// What went wrong, in words a viewer can act on.
function describe(error: unknown, serverUrl: string): string {
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status;
  if (status === 401) return "That username or password isn't right.";
  if (status === 403) return "That account can't sign in right now.";
  if (!status) {
    if (
      window.location.protocol === "https:" &&
      serverUrl.startsWith("http:")
    ) {
      return "This page is secure but the server address isn't. Use an https address.";
    }
    return "Can't reach the server. Check the address and try again.";
  }
  return "Couldn't sign in. Try again.";
}

// The only screen before the story: the name, a username, a password. When the server
// address is built in (the normal case on a shared server) that is all there is. When it
// isn't, the address is asked for here too.
export default function SignInPage() {
  const navigate = useNavigate();
  const builtInUrl = getEnvVar("JELLYFIN_SERVER_URL");

  // A returning viewer whose saved session still works goes straight in.
  const [checking, setChecking] = useState<boolean>(() =>
    Boolean(getCacheValue(JELLYFIN_AUTH_TOKEN_CACHE_KEY))
  );
  const [serverUrl, setServerUrl] = useState<string>(
    () => getCacheValue(JELLYFIN_SERVER_URL_CACHE_KEY) ?? ""
  );
  const [username, setUsername] = useState<string>(
    () => getCacheValue(JELLYFIN_USERNAME_CACHE_KEY) ?? ""
  );
  // Held in memory only. Never written to storage.
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [useToken, setUseToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Jellyfin Wrapped";
  }, []);

  useEffect(() => {
    if (!checking) return;
    let live = true;
    void resumeSession().then((ok) => {
      if (!live) return;
      if (ok) {
        setNavDirection("next");
        void navigate("/loading", { replace: true });
      } else {
        setChecking(false);
      }
    });
    return () => {
      live = false;
    };
  }, [checking, navigate]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = (builtInUrl || serverUrl).trim().replace(/\/+$/, "");
    if (!url) {
      setError("Enter the server address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setCacheValue(JELLYFIN_SERVER_URL_CACHE_KEY, url);
      if (useToken) {
        authenticateByAuthToken(url, token.trim());
        setCacheValue(JELLYFIN_AUTH_TOKEN_CACHE_KEY, token.trim());
      } else {
        await authenticateByUserName(url, username.trim(), password);
        setCacheValue(JELLYFIN_USERNAME_CACHE_KEY, username.trim());
      }
      setNavDirection("next");
      void navigate("/loading");
    } catch (caught) {
      setError(describe(caught, url));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="wp-signin">
      <h1>
        Jellyfin
        <br />
        Wrapped
      </h1>

      {checking ? (
        <div className="wp-loading" role="status" aria-label="Signing you in">
          <i />
          <i />
          <i />
        </div>
      ) : (
        <form className="wp-form" onSubmit={(event) => void onSubmit(event)}>
          {!builtInUrl && (
            <label>
              <span className="wp-sr">Server address</span>
              <input
                type="url"
                inputMode="url"
                name="server"
                placeholder="Server address"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                required
              />
            </label>
          )}

          {useToken ? (
            <label>
              <span className="wp-sr">Access token</span>
              <input
                type="text"
                name="token"
                placeholder="Access token"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
            </label>
          ) : (
            <>
              <label>
                <span className="wp-sr">Username</span>
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>
              <label>
                <span className="wp-sr">Password</span>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </>
          )}

          {error && (
            <p className="wp-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy}>
            {busy ? "Signing in" : "Sign in"}
          </button>

          {!builtInUrl && (
            <button
              type="button"
              className="wp-link"
              onClick={() => {
                setUseToken(!useToken);
                setError(null);
              }}
            >
              {useToken
                ? "Use a username and password"
                : "Use an access token instead"}
            </button>
          )}
        </form>
      )}
    </main>
  );
}
