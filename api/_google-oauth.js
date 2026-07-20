// OAuth helpers for the trip owner's connected Google account. Uploads run as this
// account (not a service account — see api/drive/index.js for why), so they consume
// the owner's own Drive storage, the same as if they'd uploaded the file by hand.

const SCOPES = "https://www.googleapis.com/auth/drive email";

export function getGoogleAuthUrl(stateToken) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // forces a fresh refresh_token every (re)connect
    state: stateToken,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Failed to exchange code for tokens");
  return data; // { access_token, refresh_token, expires_in, ... }
}

export async function fetchGoogleEmail(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email || null;
}

// Cached per user_id across warm serverless invocations.
const accessTokenCache = new Map(); // userId -> { accessToken, expiresAt }

export async function getOwnerAccessToken(sql, userId) {
  const cached = accessTokenCache.get(userId);
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.accessToken;

  const [row] = await sql`SELECT refresh_token FROM google_oauth_accounts WHERE user_id = ${userId}`;
  if (!row) throw new Error("The trip owner hasn't connected Google Drive yet (Settings → Google Drive).");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Failed to refresh Google access token");

  accessTokenCache.set(userId, { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}
