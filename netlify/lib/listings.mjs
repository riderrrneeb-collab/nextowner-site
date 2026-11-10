// Listings storage and rules for NextOwner.
// Listings are JSON objects in the "listings" blob store (one key per listing);
// photos are images in the "listing-photos" store, keyed "<owner-hash>/<uuid>.<ext>".
import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "node:crypto";
import { customersFor, plansFor } from "./shared.mjs";

export const CATEGORIES = ["Food & drink", "Fitness", "Services", "Retail", "Routes", "Other"];
const RANK = { premium: 3, featured: 2, starter: 1 };
const MAX_PHOTOS = 8;

// NextOwner admins can verify, hide or remove any listing.
export function isAdmin(email) {
  const extra = (process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return ["mynextownerofficial@gmail.com", ...extra].includes(String(email || "").toLowerCase());
}

const listingsStore = () => getStore({ name: "listings", consistency: "strong" });
export const photosStore = () => getStore({ name: "listing-photos" });

export const ownerKey = (email) => createHash("sha256").update(String(email).toLowerCase()).digest("hex").slice(0, 16);
export const newId = () => randomUUID().replace(/-/g, "").slice(0, 16);
export const PHOTO_KEY = /^[a-f0-9]{16}\/[a-f0-9-]{36}\.(jpg|png|webp)$/;

export async function allListings() {
  const store = listingsStore();
  const { blobs } = await store.list();
  const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return rows.filter(Boolean);
}

export async function getListing(id) {
  if (!/^[a-f0-9]{16}$/.test(String(id || ""))) return null;
  return listingsStore().get(id, { type: "json" });
}

export const saveListing = (l) => listingsStore().setJSON(l.id, l);

export async function removeListing(l) {
  await listingsStore().delete(l.id);
  await Promise.all((l.photos || []).map((k) => photosStore().delete(k).catch(() => {})));
}

export const isPublic = (l) => l.status !== "hidden" && l.active === true;

export function sortForDisplay(list) {
  return list.sort((a, b) => (RANK[b.tier] || 0) - (RANK[a.tier] || 0) || b.createdAt - a.createdAt);
}

// What anyone can see. Contact details are left out on purpose.
export function publicView(l) {
  return {
    id: l.id, name: l.name, category: l.category, city: l.city, state: l.state,
    lat: l.lat ?? null, lng: l.lng ?? null,
    ask: l.ask, revenue: l.revenue, cashFlow: l.cashFlow,
    yearEstablished: l.yearEstablished ?? null, employees: l.employees ?? null,
    description: l.description, reason: l.reason || "", video: l.video || "",
    photos: (l.photos || []).map((k) => `/api/photos/${k}`),
    verified: !!l.verified, tier: l.tier || "starter", createdAt: l.createdAt,
  };
}

// What the owner (or an admin) sees, including status and contact details.
export function ownerView(l) {
  return {
    ...publicView(l),
    zip: l.zip || "", photoKeys: l.photos || [],
    contactName: l.contactName || "", contactEmail: l.contactEmail || "", contactPhone: l.contactPhone || "",
    status: l.status, active: !!l.active, owner: l.owner, updatedAt: l.updatedAt,
  };
}

// ---------- Validation ----------

const text = (v, max) => (typeof v === "string" ? v.replace(/\s+\n/g, "\n").trim().slice(0, max) : "");
const money = (v) => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(String(v).replace(/[$,\s]/g, "")));
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? n : null;
};
const int = (v, lo, hi) => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function cleanListing(input, ownerEmail, allowForeignPhotos = []) {
  const errors = [];
  const year = new Date().getFullYear();
  const v = {
    name: text(input.name, 80),
    category: CATEGORIES.includes(input.category) ? input.category : "",
    city: text(input.city, 60),
    state: text(input.state, 2).toUpperCase(),
    zip: text(input.zip, 5),
    ask: money(input.ask),
    revenue: money(input.revenue),
    cashFlow: money(input.cashFlow),
    yearEstablished: int(input.yearEstablished, 1800, year),
    employees: int(input.employees, 0, 100000),
    description: text(input.description, 3000),
    reason: text(input.reason, 300),
    video: text(input.video, 300),
    contactName: text(input.contactName, 80),
    contactEmail: text(input.contactEmail, 120).toLowerCase(),
    contactPhone: text(input.contactPhone, 30),
    photos: [],
  };
  if (v.name.length < 3) errors.push("Business name");
  if (!v.category) errors.push("Category");
  if (v.city.length < 2) errors.push("City");
  if (!/^[A-Z]{2}$/.test(v.state)) errors.push("State (2 letters)");
  if (v.zip && !/^\d{5}$/.test(v.zip)) errors.push("ZIP code (5 digits)");
  if (!v.ask) errors.push("Asking price");
  if (v.revenue === null) errors.push("Yearly revenue");
  if (v.cashFlow === null) errors.push("Yearly cash flow");
  if (v.description.length < 40) errors.push("Description (at least 40 characters)");
  if (!EMAIL.test(v.contactEmail)) errors.push("Contact email");
  if (v.video && !/^https:\/\/\S+$/i.test(v.video)) errors.push("Video link (must start with https://)");

  const mine = ownerKey(ownerEmail);
  const photos = Array.isArray(input.photos) ? input.photos : [];
  for (const k of photos.slice(0, MAX_PHOTOS)) {
    const key = String(k);
    if (PHOTO_KEY.test(key) && (key.startsWith(mine + "/") || allowForeignPhotos.includes(key))) v.photos.push(key);
  }
  return { value: v, errors };
}

// Looks up coordinates for a US ZIP code so the listing can sit on the map
// and be ranked by distance. Returns nulls if the lookup is unavailable.
export async function geocodeZip(zip) {
  if (!/^\d{5}$/.test(zip || "")) return { lat: null, lng: null };
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { lat: null, lng: null };
    const data = await res.json();
    const p = data.places && data.places[0];
    const lat = Number(p && p.latitude), lng = Number(p && p.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : { lat: null, lng: null };
  } catch {
    return { lat: null, lng: null };
  }
}

// Matches an owner's listings to their active seller plans: one live listing
// per plan, best plan to oldest listing. Listings without a plan go offline
// until the owner adds one.
export async function syncOwner(email, plans, listings) {
  if (!plans) plans = await plansFor(await customersFor(email));
  const seller = plans.filter((p) => p.side === "seller").sort((a, b) => RANK[b.tier] - RANK[a.tier]);
  const all = listings || (await allListings());
  const mine = all.filter((l) => l.owner === email).sort((a, b) => a.createdAt - b.createdAt);
  if (isAdmin(email)) {
    // NextOwner's own listings (for example, ones set up for brokers) don't need a plan.
    for (const l of mine) if (l.active !== true) { l.active = true; await saveListing(l); }
    return { mine, slots: Infinity, plans };
  }
  for (let i = 0; i < mine.length; i++) {
    const l = mine[i];
    const plan = seller[i];
    const active = !!plan;
    const tier = plan ? plan.tier : l.tier || "starter";
    if (l.active !== active || l.tier !== tier) {
      l.active = active;
      l.tier = tier;
      await saveListing(l);
    }
  }
  return { mine, slots: seller.length, plans };
}
