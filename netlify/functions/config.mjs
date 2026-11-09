// Public settings the browser needs to start Supabase sign-in.
// The Supabase publishable (or legacy anon) key is designed to be public; secret keys never leave the server.
import { json } from "../lib/shared.mjs";

export default async () => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return json({ error: "Login is not set up yet." }, 503);
  return json({ supabaseUrl: url, supabaseAnonKey: anonKey });
};

export const config = { path: "/api/config" };
