// GET /api/contact/:id — a seller's contact details, for logged-in visitors only.
// Requiring a verified email login keeps bots and scrapers from harvesting sellers.
import { json, verifiedEmail } from "../lib/shared.mjs";
import { getListing, isPublic } from "../lib/listings.mjs";

export default async (req, context) => {
  try {
    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Log in to contact sellers." }, 401);
    const l = await getListing(context.params.id);
    if (!l || !isPublic(l)) return json({ error: "Listing not found." }, 404);
    return json({ name: l.contactName || "", email: l.contactEmail || "", phone: l.contactPhone || "", listing: l.name });
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/contact/:id" };
