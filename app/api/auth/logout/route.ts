import { clearSessionCookie, json } from "../../../../lib/server";

export async function POST() {
  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
}
