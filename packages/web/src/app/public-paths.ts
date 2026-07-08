// Pages reachable without a session (the auth chrome). Single source shared by the API
// client (a background 401 here is expected and must stay silent) and SettingsSync (must
// not probe /settings while unauthenticated). Keeping these in sync matters for B-022: an
// anonymous GET on the setup screen mints its own session and can clobber the freshly
// authenticated cookie, forcing one spurious re-login after setup.
export const PUBLIC_PATHS: ReadonlySet<string> = new Set(['/login', '/setup', '/invite', '/reset']);
