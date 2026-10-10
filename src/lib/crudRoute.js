import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/apiAuth";
import { CK_MANAGER_ROLES } from "@/lib/roles";

/**
 * Manager CRUD over one master table, using the service role key server-side.
 * Only CK accounts (Super Admin, CK Incharge) get through — checked on every
 * request from the login token, never from anything the screen claims.
 *
 * DELETE is a soft delete (is_active = false), never a hard one. Items and
 * branches are referenced by the movement ledger; removing a row would either
 * fail on the foreign key or orphan history. Deactivating hides it from the
 * staff screens while every past movement still reads correctly.
 */
// Turn database errors into something a manager can act on.
function friendly(error) {
  if (error.code === "23505") return "That name or code is already used by another row";
  if (error.code === "23514" && /min_order/i.test(error.message)) {
    return "Min order must be a whole number (1 or more), or blank";
  }
  if (error.code === "23514" && /pack_qty/i.test(error.message)) {
    return "Contents must be a number above 0, or blank";
  }
  if (error.code === "23514" && /code/i.test(error.message)) {
    return "Code must be 2–5 capital letters, e.g. TRX";
  }
  return error.message;
}

// `validate(payload)` (optional) may tidy the payload in place and returns
// an error message, or null when it is fine.
export function crudRoute(table, allowedFields, validate = null) {
  function clean(body) {
    const out = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) out[key] = body[key];
    }
    return out;
  }

  return {
    async GET(request) {
      const caller = await requireRoles(request, CK_MANAGER_ROLES);
      if (caller.error) return caller.error;

      const { data, error } = await supabaseAdmin()
        .from(table)
        .select("*")
        .order("name");
      if (error) return Response.json({ error: friendly(error) }, { status: 400 });
      return Response.json({ data });
    },

    async POST(request) {
      const caller = await requireRoles(request, CK_MANAGER_ROLES);
      if (caller.error) return caller.error;

      const body = await request.json().catch(() => ({}));
      const payload = clean(body);
      if (!payload.name || !String(payload.name).trim()) {
        return Response.json({ error: "Name is required" }, { status: 400 });
      }
      payload.name = String(payload.name).trim();
      const invalid = validate ? validate(payload) : null;
      if (invalid) return Response.json({ error: invalid }, { status: 400 });

      const { data, error } = await supabaseAdmin()
        .from(table)
        .insert(payload)
        .select()
        .single();
      if (error) return Response.json({ error: friendly(error) }, { status: 400 });
      return Response.json({ data });
    },

    async PATCH(request) {
      const caller = await requireRoles(request, CK_MANAGER_ROLES);
      if (caller.error) return caller.error;

      const body = await request.json().catch(() => ({}));
      if (!body.id) return Response.json({ error: "id is required" }, { status: 400 });

      const payload = clean(body);
      if (payload.name !== undefined) payload.name = String(payload.name).trim();
      if (Object.keys(payload).length === 0) {
        return Response.json({ error: "Nothing to update" }, { status: 400 });
      }
      const invalid = validate ? validate(payload) : null;
      if (invalid) return Response.json({ error: invalid }, { status: 400 });

      const { data, error } = await supabaseAdmin()
        .from(table)
        .update(payload)
        .eq("id", body.id)
        .select()
        .single();
      if (error) return Response.json({ error: friendly(error) }, { status: 400 });
      return Response.json({ data });
    },

    async DELETE(request) {
      const caller = await requireRoles(request, CK_MANAGER_ROLES);
      if (caller.error) return caller.error;

      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });

      const { error } = await supabaseAdmin()
        .from(table)
        .update({ is_active: false })
        .eq("id", id);
      if (error) return Response.json({ error: friendly(error) }, { status: 400 });
      return Response.json({ ok: true });
    },
  };
}
