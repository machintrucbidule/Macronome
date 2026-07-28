// Did the session store actually have the session the browser presented? (B-231.)
//
// express-session does not expose loaded-vs-generated, but it leaks it structurally: it sets
// `req.sessionID` from the cookie, and on a store miss `generate()` REPLACES it with a fresh id.
// So comparing the presented cookie against the final `req.sessionID` answers the question.
//
// The cookie value is `s:<sid>.<hmac>`, so a plain substring test on the unsigned id is exact and
// needs no secret and no unsign step. The value is consumed here and reduced to a boolean — it
// never reaches the record.
//
// Distinguishing the three outcomes is the point: "presented but not found" is a store problem,
// "not presented" is a cookie problem, and `null` means the session middleware never completed.

/** true = the store had it · false = no usable session · null = unknown (middleware never ran). */
export function sessionWasFound(
  signedSidCookie: string | undefined,
  sessionId: string | undefined,
): boolean | null {
  if (sessionId === undefined) return null;
  if (signedSidCookie === undefined) return false;
  return signedSidCookie.includes(sessionId);
}
