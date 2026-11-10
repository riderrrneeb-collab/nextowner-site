// Daily check that every live listing still has a paid seller plan.
// Takes listings offline when a plan is canceled and restores them when it's renewed.
// Runs at 10:00 UTC (3am Mountain in winter, 4am in summer).
import { allListings, syncOwner, allSellers } from "../lib/listings.mjs";
import { refreshSeller } from "../lib/verification.mjs";

export default async () => {
  const listings = await allListings();
  const owners = [...new Set(listings.map((l) => l.owner))];
  let changed = 0;
  for (const email of owners) {
    try {
      const before = listings.filter((l) => l.owner === email).map((l) => `${l.active}:${l.tier}`).join();
      const { mine } = await syncOwner(email, null, listings);
      if (mine.map((l) => `${l.active}:${l.tier}`).join() !== before) changed++;
    } catch (err) {
      console.error(`Sync failed for an owner: ${err.message}`);
    }
  }
  // Pick up ID checks that finished after the seller left the page.
  let verified = 0;
  for (const seller of await allSellers()) {
    if (seller.idVerified || seller.verifyStatus !== "processing") continue;
    try { if ((await refreshSeller(seller)).idVerified) verified++; } catch (err) { console.error(`ID check refresh failed: ${err.message}`); }
  }
  console.log(`Listing sync: ${owners.length} owners checked, ${changed} updated, ${verified} newly ID-verified.`);
};

export const config = { schedule: "0 10 * * *" };
