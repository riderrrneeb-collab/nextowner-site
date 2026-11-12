// NextOwner admin tools (admins only).
// GET   /api/admin/listings      — every listing, including hidden and unpaid ones
// PATCH /api/admin/listings/:id  — set { verified: true|false }, { status: "live"|"hidden" },
//                                  or { owner: "broker@email" } to hand a listing set up by NextOwner to its broker
import { json, verifiedEmail } from "../lib/shared.mjs";
import { allListings, getListing, saveListing, ownerView, isAdmin, syncOwner, getSeller } from "../lib/listings.mjs";

export default async (req, context) => {
  try {
    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Please log in." }, 401);
    if (!isAdmin(email)) return json({ error: "Admins only." }, 403);

    const id = context.params && context.params.id;
    if (req.method === "GET" && !id) {
      const rows = (await allListings()).sort((a, b) => b.createdAt - a.createdAt).map(ownerView);
      return json({ listings: rows });
    }

    if (req.method === "PATCH" && id) {
      const l = await getListing(id);
      if (!l) return json({ error: "Listing not found." }, 404);
      let body;
      try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
      if (typeof body.verified === "boolean") {
        l.verified = body.verified;
        l.verifiedAt = body.verified ? Date.now() : null;
        l.verifiedBy = body.verified ? email : null;
      }
      if (body.status === "live" || body.status === "hidden") l.status = body.status;
      let moved = null;
      if (typeof body.owner === "string") {
        const to = body.owner.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "Enter a valid email to move this listing to." }, 400);
        if (to !== l.owner) { moved = l.owner; l.owner = to; l.verified = !!(await getSeller(to)).idVerified; }
      }
      l.updatedAt = Date.now();
      await saveListing(l);
      if (moved) { await syncOwner(moved); await syncOwner(l.owner); Object.assign(l, await getListing(l.id)); }
      return json({ ok: true, listing: ownerView(l) });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: ["/api/admin/listings", "/api/admin/listings/:id"] };
