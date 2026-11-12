// Shared helpers for NextOwner's server functions.
// Secrets come from Netlify environment variables; nothing secret is sent to the browser.

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

// Supabase public key: the new "publishable" key, or the legacy "anon" key.
export function supabaseKey() {
  const v = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!v) throw new Error("Missing environment variable SUPABASE_PUBLISHABLE_KEY");
  return v;
}

// Confirms the Supabase login token and returns the signed-in user's verified email.
export async function verifiedEmail(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const res = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: supabaseKey(), authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user || !user.email || !user.email_confirmed_at) return null;
  return user.email.toLowerCase();
}

async function stripe(method, path, params) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  const init = {
    method,
    headers: { authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` },
  };
  const body = new URLSearchParams();
  for (const [k, v] of params || []) body.append(k, v);
  if (method === "GET") url.search = body.toString();
  else {
    init.body = body.toString();
    init.headers["content-type"] = "application/x-www-form-urlencoded";
  }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

// All Stripe customers with this email (checkout can create more than one).
export async function customersFor(email) {
  const out = [];
  let starting_after;
  for (let page = 0; page < 5; page++) {
    const params = [["email", email], ["limit", "100"]];
    if (starting_after) params.push(["starting_after", starting_after]);
    const list = await stripe("GET", "customers", params);
    out.push(...list.data);
    if (!list.has_more) break;
    starting_after = list.data[list.data.length - 1].id;
  }
  if (!out.length) {
    // The email filter above is case-sensitive; Stripe's search is not, so it
    // catches checkouts typed with different capitalization.
    const safe = email.replace(/['\\]/g, "");
    const found = await stripe("GET", "customers/search", [["query", `email:'${safe}'`], ["limit", "100"]]);
    out.push(...found.data);
  }
  return out;
}

const LIVE = new Set(["active", "trialing", "past_due"]);
const NAMES = {
  starter: "Seller Starter",
  featured: "Seller Featured",
  premium: "Seller Premium",
  buyer_premium: "Buyer Premium",
  broker_pro: "Broker Pro",
};
// How many live listings a seller plan covers, and at which listing tier.
const LISTINGS = { broker_pro: { count: 50, tier: "featured" } };

// The user's current NextOwner plans, read from Stripe subscriptions.
export async function plansFor(customers) {
  const plans = [];
  for (const c of customers) {
    const subs = await stripe("GET", "subscriptions", [["customer", c.id], ["status", "all"], ["limit", "100"]]);
    for (const s of subs.data) {
      if (!LIVE.has(s.status)) continue;
      for (const item of s.items.data) {
        const tier = item.price?.metadata?.tier;
        if (!tier || !NAMES[tier]) continue;
        plans.push({
          tier,
          name: NAMES[tier],
          side: tier === "buyer_premium" ? "buyer" : "seller",
          listings: (LISTINGS[tier] || { count: 1 }).count,
          listingTier: (LISTINGS[tier] || { tier }).tier,
          billing: item.price.recurring?.interval === "year" ? "yearly" : "monthly",
          amount: item.price.unit_amount,
          status: s.status,
          renews_at: item.current_period_end || s.current_period_end || null,
          cancel_at_period_end: !!s.cancel_at_period_end,
          customer: c.id,
        });
      }
    }
  }
  return plans;
}

export async function portalSession(customer, returnUrl) {
  return stripe("POST", "billing_portal/sessions", [["customer", customer], ["return_url", returnUrl]]);
}

// Generic Stripe API call for other helpers (e.g. Stripe Identity).
export const stripeRequest = stripe;
