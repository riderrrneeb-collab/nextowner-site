// GET  /api/listings  — every live listing, best placement first (public)
// POST /api/listings  — create a listing. Anyone logged in can save a draft;
//                       publishing needs an open seller-plan slot.
import { json, verifiedEmail } from "../lib/shared.mjs";
import {
  allListings, isPublic, sortForDisplay, publicView, cleanListing, geocodeZip,
  newId, saveListing, syncOwner, getSeller,
} from "../lib/listings.mjs";

const MAX_DRAFTS = 3;
const MAX_LISTINGS = 50;

export default async (req) => {
  try {
    if (req.method === "GET") {
      const live = sortForDisplay((await allListings()).filter(isPublic)).map(publicView);
      return new Response(JSON.stringify({ listings: live }), {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }

    if (req.method === "POST") {
      const email = await verifiedEmail(req);
      if (!email) return json({ error: "Please log in." }, 401);
      const before = await syncOwner(email);
      if (before.mine.length >= MAX_LISTINGS) return json({ error: "You've reached the listing limit for one account." }, 409);
      if (before.mine.filter((l) => l.status === "draft").length >= MAX_DRAFTS) {
        return json({ error: "You already have " + MAX_DRAFTS + " unpublished drafts. Publish or delete one first." }, 409);
      }
      let body;
      try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
      const { value, errors } = cleanListing(body, email);
      if (errors.length) return json({ error: "Please check: " + errors.join(", ") + ".", fields: errors }, 400);
      const coords = await geocodeZip(value.zip);
      const seller = await getSeller(email);
      const now = Date.now();
      const canPublish = before.admin || before.used < before.slots;
      const listing = {
        ...value, ...coords, id: newId(), owner: email, createdAt: now, updatedAt: now,
        status: body.publish && canPublish ? "live" : "draft",
        verified: !!seller.idVerified, active: false, tier: "free",
      };
      await saveListing(listing);
      await syncOwner(email, before.plans);
      return json({
        ok: true, id: listing.id, status: listing.status,
        needPlan: !!body.publish && listing.status === "draft", hasPlan: (before.paidSlots || 0) > 0,
      }, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/listings" };
