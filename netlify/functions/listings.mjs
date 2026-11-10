// GET  /api/listings  — every live listing, best placement first (public)
// POST /api/listings  — create a listing (logged-in seller with an open plan slot)
import { json, verifiedEmail } from "../lib/shared.mjs";
import {
  allListings, isPublic, sortForDisplay, publicView, cleanListing, geocodeZip,
  newId, saveListing, syncOwner, isAdmin,
} from "../lib/listings.mjs";

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
      const admin = isAdmin(email);
      const { mine, slots, plans } = await syncOwner(email);
      if (!admin && slots === 0) {
        return json({ error: "You need a seller plan to list a business.", needPlan: true }, 402);
      }
      if (!admin && mine.length >= slots) {
        return json({ error: "Each seller plan includes one listing. Add another plan to list another business.", needPlan: true }, 409);
      }
      let body;
      try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
      const { value, errors } = cleanListing(body, email);
      if (errors.length) return json({ error: "Please check: " + errors.join(", ") + ".", fields: errors }, 400);
      const coords = await geocodeZip(value.zip);
      const now = Date.now();
      const listing = {
        ...value, ...coords, id: newId(), owner: email, createdAt: now, updatedAt: now,
        status: "live", verified: false, active: admin, tier: "starter",
      };
      await saveListing(listing);
      if (!admin) await syncOwner(email, plans);
      return json({ ok: true, id: listing.id }, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/listings" };
