// POST /api/photos       — upload one listing photo (logged-in seller or admin)
// GET  /api/photos/<key> — serve a listing photo
import { randomUUID } from "node:crypto";
import { json, verifiedEmail } from "../lib/shared.mjs";
import { photosStore, ownerKey, isAdmin, PHOTO_KEY } from "../lib/listings.mjs";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 4 * 1024 * 1024;

export default async (req) => {
  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const key = decodeURIComponent(url.pathname.replace(/^\/api\/photos\//, ""));
      if (!PHOTO_KEY.test(key)) return new Response("Not found", { status: 404 });
      const entry = await photosStore().getWithMetadata(key, { type: "arrayBuffer" });
      if (entry === null) return new Response("Not found", { status: 404 });
      return new Response(entry.data, {
        headers: {
          "content-type": entry.metadata?.contentType || "image/jpeg",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (req.method === "POST") {
      const email = await verifiedEmail(req);
      if (!email) return json({ error: "Please log in." }, 401);
      // Anyone logged in can add photos to a draft; cap storage per account.
      if (!isAdmin(email)) {
        const { blobs } = await photosStore().list({ prefix: ownerKey(email) + "/" });
        if (blobs.length >= 80) return json({ error: "Photo limit reached for this account. Remove some photos first." }, 409);
      }
      const type = (req.headers.get("content-type") || "").split(";")[0].trim();
      const ext = TYPES[type];
      if (!ext) return json({ error: "Photos must be JPG, PNG or WebP." }, 415);
      const data = await req.arrayBuffer();
      if (!data.byteLength) return json({ error: "Empty file." }, 400);
      if (data.byteLength > MAX_BYTES) return json({ error: "That photo is too large (max 4 MB)." }, 413);
      const key = `${ownerKey(email)}/${randomUUID()}.${ext}`;
      await photosStore().set(key, data, { metadata: { contentType: type } });
      return json({ key, url: `/api/photos/${key}` }, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Photo upload failed. Try again." }, 500);
  }
};

export const config = { path: ["/api/photos", "/api/photos/*"] };
