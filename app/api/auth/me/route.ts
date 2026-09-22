import { getCurrentUser, json } from "../../../../lib/server";

export async function GET(request: Request) {
  try { return json({ user: await getCurrentUser(request) }); }
  catch (error) { console.error("me", error); return json({ user: null }); }
}
