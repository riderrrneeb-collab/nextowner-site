// GET /api/brokers/:slug — an approved broker's public profile and their live listings.
import { json } from "../lib/shared.mjs";
import { allSellers, allListings, isPublic, sortForDisplay, publicView } from "../lib/listings.mjs";

export default async (req, context) => {
  try {
    const slug = String(context.params.slug || "");
    if (!/^[a-z0-9-]{3,64}$/.test(slug)) return json({ error: "Broker not found." }, 404);
    const seller = (await allSellers()).find((s) => s.broker && s.broker.slug === slug && s.broker.status === "approved");
    if (!seller) return json({ error: "Broker not found." }, 404);
    const b = seller.broker;
    const listings = sortForDisplay((await allListings()).filter((l) => l.owner === seller.email && isPublic(l))).map(publicView);
    return json({
      broker: { name: b.name, firm: b.firm, license: b.license || "", licenseState: b.licenseState || "", website: b.website || "",
        phone: b.phone || "", bio: b.bio || "", slug: b.slug, verified: !!seller.idVerified },
      listings,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/brokers/:slug" };
