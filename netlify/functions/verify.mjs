// Seller ID verification through Stripe Identity (document + matching selfie).
// POST /api/verify — start a check; returns Stripe's hosted verification URL
// GET  /api/verify — current status; when Stripe reports "verified", every one
//                    of the seller's listings gets the ✓ Verified badge.
import { json, verifiedEmail, customersFor, plansFor, stripeRequest } from "../lib/shared.mjs";
import { getSeller, saveSeller, isAdmin, brokerActive } from "../lib/listings.mjs";
import { refreshSeller } from "../lib/verification.mjs";

const view = (s) => ({ verified: !!s.idVerified, status: s.idVerified ? "verified" : s.verifyStatus || "none", error: s.lastError || "" });

export default async (req) => {
  try {
    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Please log in." }, 401);
    let seller = await getSeller(email);

    if (req.method === "GET") {
      seller = await refreshSeller(seller);
      return json(view(seller));
    }

    if (req.method === "POST") {
      if (seller.idVerified) return json(view(seller));
      if (!isAdmin(email) && !brokerActive(seller)) {
        const plans = await plansFor(await customersFor(email));
        if (!plans.some((p) => p.side === "seller")) {
          return json({ error: "ID verification is included with every seller plan.", needPlan: true }, 402);
        }
      }
      // Reuse an unfinished check instead of starting (and paying for) a new one.
      if (seller.sessionId) {
        const existing = await stripeRequest("GET", `identity/verification_sessions/${seller.sessionId}`);
        if (existing.status === "requires_input" && existing.url) return json({ url: existing.url });
        if (existing.status === "processing") return json({ ...view({ ...seller, verifyStatus: "processing" }) });
        if (existing.status === "verified") { seller = await refreshSeller(seller); return json(view(seller)); }
      }
      const origin = new URL(req.url).origin;
      const session = await stripeRequest("POST", "identity/verification_sessions", [
        ["type", "document"],
        ["options[document][require_matching_selfie]", "true"],
        ["options[document][require_live_capture]", "true"],
        ["provided_details[email]", email],
        ["metadata[email]", email],
        ["metadata[purpose]", "nextowner_seller"],
        ["return_url", `${origin}/account?verify=done`],
      ]);
      seller = { ...seller, email, sessionId: session.id, verifyStatus: session.status, lastError: "", startedAt: Date.now() };
      await saveSeller(seller);
      return json({ url: session.url });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error(err);
    const msg = /identity/i.test(err.message || "") ? "ID verification isn't available yet. Try again later." : "Could not start ID verification. Try again in a moment.";
    return json({ error: msg }, 500);
  }
};

export const config = { path: "/api/verify" };
