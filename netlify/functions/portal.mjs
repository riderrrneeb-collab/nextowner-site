// Opens Stripe's billing portal for the signed-in user so they can
// upgrade, downgrade, update their card, see invoices or cancel.
import { json, verifiedEmail, customersFor, plansFor, portalSession } from "../lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Please log in." }, 401);
    const customers = await customersFor(email);
    if (!customers.length) return json({ error: "No billing account found for this email yet." }, 404);
    // Prefer the customer that holds a live plan; otherwise the most recent one.
    const plans = await plansFor(customers);
    const customer = plans[0]?.customer || customers[0].id;
    const origin = new URL(req.url).origin;
    const session = await portalSession(customer, `${origin}/account`);
    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not open billing. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/portal" };
