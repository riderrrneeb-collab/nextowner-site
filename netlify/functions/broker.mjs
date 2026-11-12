// GET  /api/broker — the logged-in person's broker application/profile and status
// POST /api/broker — apply as a broker, or update an existing broker profile.
//   New applications start "pending" until NextOwner approves them on the admin page.
import { json, verifiedEmail } from "../lib/shared.mjs";
import {
  getSeller, saveSeller, brokerSlug, syncOwner, BROKER_LISTINGS, brokerActive,
} from "../lib/listings.mjs";

const text = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));

function website(v) {
  let u = text(v, 200);
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.includes(".") ? x.toString() : null; } catch { return null; }
}

function brokerView(b) {
  if (!b) return null;
  return { status: b.status, name: b.name, firm: b.firm, license: b.license || "", licenseState: b.licenseState || "",
    website: b.website || "", phone: b.phone || "", bio: b.bio || "", slug: b.slug || "", appliedAt: b.appliedAt || null };
}

export default async (req) => {
  try {
    const email = await verifiedEmail(req);
    if (!email) return json({ error: "Please log in." }, 401);
    const seller = await getSeller(email);
    const terms = { listings: BROKER_LISTINGS };

    if (req.method === "GET") return json({ broker: brokerView(seller.broker), active: brokerActive(seller), terms });

    if (req.method === "POST") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
      const b = {
        name: text(body.name, 80), firm: text(body.firm, 100), license: text(body.license, 40),
        licenseState: STATES.has(String(body.licenseState || "").toUpperCase()) ? String(body.licenseState).toUpperCase() : "",
        website: website(body.website), phone: text(body.phone, 30), bio: text(body.bio, 600),
      };
      const errors = [];
      if (b.name.length < 2) errors.push("your name");
      if (b.firm.length < 2) errors.push("brokerage name");
      if (b.website === null) errors.push("website");
      if (b.phone && !/^[\d\s()+.-]{7,30}$/.test(b.phone)) errors.push("phone");
      if (errors.length) return json({ error: "Please check: " + errors.join(", ") + ".", fields: errors }, 400);
      const prev = seller.broker || {};
      seller.email = email;
      seller.broker = {
        ...prev, ...b, website: b.website || "",
        status: prev.status === "approved" || prev.status === "rejected" ? prev.status : "pending",
        slug: prev.slug || brokerSlug(b, email),
        appliedAt: prev.appliedAt || Date.now(), updatedAt: Date.now(),
      };
      await saveSeller(seller);
      if (seller.broker.status === "approved") await syncOwner(email); // refresh "Listed by" on their listings
      return json({ ok: true, broker: brokerView(seller.broker), active: brokerActive(seller), terms });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/broker" };
