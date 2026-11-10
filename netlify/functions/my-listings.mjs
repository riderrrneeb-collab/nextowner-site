// GET /api/my-listings — the logged-in seller's listings, plan slots, and admin flag.
import { json, verifiedEmail } from "../lib/shared.mjs";
import { syncOwner, ownerView, isAdmin } from "../lib/listings.mjs";

export default async (req) => {
  try {
    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Please log in." }, 401);
    const { mine, slots } = await syncOwner(email);
    const admin = isAdmin(email);
    return json({
      email, admin, slots, used: mine.length,
      canCreate: admin || mine.length < slots,
      listings: mine.map(ownerView),
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not load your listings. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/my-listings" };
