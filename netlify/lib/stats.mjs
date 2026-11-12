// Listing stats: daily counts of page views and contact reveals ("inquiries").
// One small JSON blob per listing: { days: { "2026-11-12": [views, inquiries] } }, kept to 120 days.
import { getStore } from "@netlify/blobs";

const KEEP_DAYS = 120;
const store = () => getStore("listing-stats");
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

export async function bump(id, field) {
  const i = field === "inquiry" ? 1 : 0;
  const s = (await store().get(id, { type: "json" })) || { days: {} };
  const d = day();
  const row = s.days[d] || [0, 0];
  row[i] += 1;
  s.days[d] = row;
  const cutoff = day(Date.now() - KEEP_DAYS * 86400000);
  for (const k of Object.keys(s.days)) if (k < cutoff) delete s.days[k];
  await store().setJSON(id, s);
}

// { [id]: { views30, inquiries30, viewsAll, inquiriesAll } } for the given listing ids.
export async function summaries(ids) {
  const since = day(Date.now() - 29 * 86400000);
  const out = {};
  await Promise.all(ids.map(async (id) => {
    const s = (await store().get(id, { type: "json" }).catch(() => null)) || { days: {} };
    const r = { views30: 0, inquiries30: 0, viewsAll: 0, inquiriesAll: 0 };
    for (const [k, [v, c]] of Object.entries(s.days)) {
      r.viewsAll += v; r.inquiriesAll += c;
      if (k >= since) { r.views30 += v; r.inquiries30 += c; }
    }
    out[id] = r;
  }));
  return out;
}

export async function removeStats(id) { await store().delete(id).catch(() => {}); }
