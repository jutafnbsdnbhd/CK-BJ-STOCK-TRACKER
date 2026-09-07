import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireManager } from "@/lib/managerAuth";

/**
 * Manager CRUD over one master table, using the service role key server-side.
 *
 * DELETE is a soft delete (is_active = false), never a hard one. Items and
 * branches are referenced by the movement ledger; removing a row would either
 * fail on the foreign key or orphan history. Deactivating hides it from the
 * staff screens while every past movement still reads correctly.
 */
export function crudRoute(table, allowedFields) {
  function clean(body) {
    const out = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) out[key] = body[key];
    }
    return out;
  }

  return {
    async GET() {
      const denied = requireManager();
      if (denied) return denied;

      const { data, error } = await supabaseAdmin()
        .from(table)
        .select("*")
        .order("name");
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data });
    },

    async POST(request) {
      const denied = requireManager();
      if (denied) return denied;

      const body = await request.json().catch(() => ({}));
      const payload = clean(body);
      if (!payload.name || !String(payload.name).trim()) {
        return Response.json({ error: "Name is required" }, { status: 400 });
      }
      payload.name = String(payload.name).trim();

      const { data, error } = await supabaseAdmin()
        .from(table)
        .insert(payload)
        .select()
        .single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data });
    },

    async PATCH(request) {
      const denied = requireManager();
      if (denied) return denied;

      const body = await request.json().catch(() => ({}));
      if (!body.id) return Response.json({ error: "id is required" }, { status: 400 });

      const payload = clean(body);
      if (payload.name !== undefined) payload.name = String(payload.name).trim();
      if (Object.keys(payload).length === 0) {
        return Response.json({ error: "Nothing to update" }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin()
        .from(table)
        .update(payload)
        .eq("id", body.id)
        .select()
        .single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data });
    },

    async DELETE(request) {
      const denied = requireManager();
      if (denied) return denied;

      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });

      const { error } = await supabaseAdmin()
        .from(table)
        .update({ is_active: false })
        .eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ ok: true });
    },
  };
}
