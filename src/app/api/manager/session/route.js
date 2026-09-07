import { isManager } from "@/lib/managerAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ authed: isManager() });
}
