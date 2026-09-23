import { errorResponse, getCurrentUser, json } from "../../../lib/server";
import { flameSummary, FLAME_REWARDS } from "../../../lib/flames";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  return json({ ...(await flameSummary(user.id)), rules: FLAME_REWARDS });
}
