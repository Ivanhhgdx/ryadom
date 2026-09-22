import { clearSessionCookie, json, revokeSession } from "../../../../lib/server";

export async function POST(request: Request) {
  await revokeSession(request);
  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
}
