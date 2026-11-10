// GET    /api/listings/:id — one live listing (public)
// PUT    /api/listings/:id — edit (owner or admin)
// DELETE /api/listings/:id — remove (owner or admin)
import { json, verifiedEmail } from "../lib/shared.mjs";
import {
  getListing, isPublic, publicView, cleanListing, geocodeZip, saveListing, removeListing, isAdmin, photosStore, syncOwner,
} from "../lib/listings.mjs";

export default async (req, context) => {
  try {
    const listing = await getListing(context.params.id);

    if (req.method === "GET") {
      if (!listing || !isPublic(listing)) return json({ error: "Listing not found." }, 404);
      return json({ listing: publicView(listing) });
    }

    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Please log in." }, 401);
    if (!listing) return json({ error: "Listing not found." }, 404);
    const admin = isAdmin(email);
    if (listing.owner !== email && !admin) return json({ error: "You can only change your own listings." }, 403);

    if (req.method === "PUT") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
      // Keep photos already on this listing even when an admin edits it.
      const { value, errors } = cleanListing(body, listing.owner, listing.photos || []);
      if (errors.length) return json({ error: "Please check: " + errors.join(", ") + ".", fields: errors }, 400);
      const coords = value.zip === listing.zip && listing.lat != null
        ? { lat: listing.lat, lng: listing.lng } : await geocodeZip(value.zip);
      const removed = (listing.photos || []).filter((k) => !value.photos.includes(k));
      const updated = { ...listing, ...value, ...coords, updatedAt: Date.now() };
      await saveListing(updated);
      await Promise.all(removed.map((k) => photosStore().delete(k).catch(() => {})));
      // Publishing a draft needs an open seller-plan slot.
      let needPlan = false;
      if (body.publish && updated.status === "draft") {
        const owner = await syncOwner(updated.owner);
        const fresh = owner.mine.find((l) => l.id === updated.id);
        if (owner.admin || (fresh && fresh.active)) { fresh.status = "live"; fresh.updatedAt = Date.now(); await saveListing(fresh); updated.status = "live"; }
        else needPlan = true;
        return json({ ok: true, id: updated.id, status: updated.status, needPlan, hasPlan: (owner.paidSlots || 0) > 0 });
      }
      return json({ ok: true, id: updated.id, status: updated.status });
    }

    if (req.method === "DELETE") {
      await removeListing(listing);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/listings/:id" };
