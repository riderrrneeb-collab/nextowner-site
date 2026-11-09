// Returns the signed-in user's NextOwner plans from Stripe.
import { json, verifiedEmail, customersFor, plansFor } from "../lib/shared.mjs";

export default async (req) => {
  try {
    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Please log in." }, 401);
    const customers = await customersFor(email);
    const plans = await plansFor(customers);
    return json({
      email,
      plans,
      buyerPremium: plans.some((p) => p.tier === "buyer_premium"),
      seller: plans.some((p) => p.side === "seller"),
      hasBilling: customers.length > 0,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not load your membership. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/membership" };
