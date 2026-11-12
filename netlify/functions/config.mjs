// Public settings the browser needs to start Supabase sign-in.
// The Supabase publishable (or legacy anon) key is designed to be public; secret keys never leave the server.
import { json } from "../lib/shared.mjs";

export default async () => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return json({ error: "Login is not set up yet." }, 503);
  // Set GOOGLE_LOGIN=on in Netlify once Google is enabled in Supabase.
  // Google Drive photo picker: shown only when all three values are set in Netlify.
  const picker = process.env.GOOGLE_PICKER_API_KEY && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_PROJECT_NUMBER
    ? { apiKey: process.env.GOOGLE_PICKER_API_KEY, clientId: process.env.GOOGLE_CLIENT_ID, appId: process.env.GOOGLE_PROJECT_NUMBER }
    : null;
  return json({ supabaseUrl: url, supabaseAnonKey: anonKey, googleLogin: process.env.GOOGLE_LOGIN === "on", googlePicker: picker });
};

export const config = { path: "/api/config" };
