import { crudRoute } from "@/lib/crudRoute";

export const dynamic = "force-dynamic";

const handlers = crudRoute("branches", ["name", "is_active"]);

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
