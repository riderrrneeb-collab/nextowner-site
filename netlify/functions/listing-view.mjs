// POST /api/listings/:id/view — counts one page view of a live listing (anonymous).
import { json } from "../lib/shared.mjs";
import { getListing, isPublic } from "../lib/listings.mjs";
import { bump } from "../lib/stats.mjs";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

export default async (req, context) => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (BOT.test(req.headers.get("user-agent") || "")) return json({ ok: true, counted: false });
    const l = await getListing(context.params.id);
    if (!l || !isPublic(l)) return json({ error: "Listing not found." }, 404);
    await bump(l.id, "view");
    return json({ ok: true, counted: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false }, 500);
  }
};

export const config = { path: "/api/listings/:id/view" };
