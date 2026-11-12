// GET /api/my-listings — the logged-in seller's listings, plan slots, and admin flag.
import { json, verifiedEmail } from "../lib/shared.mjs";
import { syncOwner, ownerView, getSeller, PHOTO_LIMIT } from "../lib/listings.mjs";
import { summaries } from "../lib/stats.mjs";

export default async (req) => {
  try {
    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Please log in." }, 401);
    const { mine, slots, used, bestTier, admin, broker, brokerPro } = await syncOwner(email);
    const stats = await summaries(mine.map((l) => l.id));
    const seller = await getSeller(email);
    return json({
      email, admin, slots: admin ? 999 : slots, used, bestTier,
      canPublish: admin || used < slots,
      photoLimits: PHOTO_LIMIT,
      idVerified: !!seller.idVerified, verifyStatus: seller.verifyStatus || "none",
      broker, brokerPro, brokerStatus: (seller.broker && seller.broker.status) || null, brokerSlug: (seller.broker && seller.broker.slug) || null,
      listings: mine.map((l) => ({ ...ownerView(l), stats: stats[l.id] })),
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not load your listings. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/my-listings" };
