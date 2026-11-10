// Stripe Identity status checks for sellers.
import { stripeRequest } from "./shared.mjs";
import { saveSeller, markOwnerVerified } from "./listings.mjs";

// Asks Stripe for the latest status and records it.
export async function refreshSeller(seller) {
  if (!seller.sessionId || seller.idVerified) return seller;
  const s = await stripeRequest("GET", `identity/verification_sessions/${seller.sessionId}`);
  seller.verifyStatus = s.status; // requires_input | processing | verified | canceled
  seller.lastError = s.last_error ? s.last_error.reason || s.last_error.code || "" : "";
  if (s.status === "verified") {
    seller.idVerified = true;
    seller.verifiedAt = Date.now();
    await markOwnerVerified(seller.email);
  }
  await saveSeller(seller);
  return seller;
}

