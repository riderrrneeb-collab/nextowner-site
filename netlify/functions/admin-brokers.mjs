// NextOwner admin: broker applications.
// GET   /api/admin/brokers        — every broker application, newest first
// PATCH /api/admin/brokers/:key   — { status: "approved" | "rejected" | "pending" }
import { json, verifiedEmail } from "../lib/shared.mjs";
import { allSellers, allListings, saveSeller, ownerKey, isAdmin, syncOwner } from "../lib/listings.mjs";

export default async (req, context) => {
  try {
    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Please log in." }, 401);
    if (!isAdmin(email)) return json({ error: "Admins only." }, 403);
    const sellers = (await allSellers()).filter((s) => s.broker && s.email);
    const key = context.params && context.params.key;

    if (req.method === "GET" && !key) {
      const listings = await allListings();
      const rows = sellers.map((s) => ({
        key: ownerKey(s.email), email: s.email, ...s.broker, idVerified: !!s.idVerified,
        listings: listings.filter((l) => l.owner === s.email).length,
      })).sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || (b.appliedAt || 0) - (a.appliedAt || 0));
      return json({ brokers: rows });
    }

    if (req.method === "PATCH" && key) {
      const s = sellers.find((x) => ownerKey(x.email) === key);
      if (!s) return json({ error: "Broker not found." }, 404);
      let body;
      try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
      if (!["approved", "rejected", "pending"].includes(body.status)) return json({ error: "Invalid status." }, 400);
      s.broker.status = body.status;
      s.broker.reviewedAt = Date.now();
      s.broker.reviewedBy = email;
      await saveSeller(s);
      await syncOwner(s.email); // give or take away the broker's listing slots and "Listed by" credit
      return json({ ok: true, broker: { key, email: s.email, ...s.broker } });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: ["/api/admin/brokers", "/api/admin/brokers/:key"] };
