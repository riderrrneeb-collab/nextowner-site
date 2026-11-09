# NextOwner website

Static pages plus three small Netlify Functions that power member logins.

| File | What it is |
|---|---|
| `index.html` | Marketplace preview, Best Picks finder, subscription prompt |
| `pricing.html` | Plans with Stripe checkout links |
| `login.html` | Email sign-in link (no passwords), via Supabase |
| `account.html` | Member's plans from Stripe + "Manage billing and plans" |
| `auth.js`, `account.css` | Shared login helper and styles |
| `netlify/functions/` | `config` (public Supabase settings), `membership` (looks up plans in Stripe), `portal` (opens Stripe billing) |
| `netlify.toml` | Tells Netlify where the site and functions live |

## One-time setup

1. **GitHub:** create a repository (for example `nextowner-site`) and upload every file and folder here, keeping the `netlify` folder structure.
2. **Netlify:** link your existing mynextowner.com site to that repository. Leave the build command empty; the publish directory is `.` (set in `netlify.toml`). Every push to GitHub now deploys automatically.
3. **Supabase** (free): create a project. Under Authentication → URL Configuration, set the Site URL to `https://mynextowner.com` and add `https://mynextowner.com/account` as a redirect URL. From the project's API settings, copy the **Project URL** and the **anon / public** key.
4. **Stripe:** in Developers → API keys, create a **restricted key** with read access to Customers and Subscriptions, and write access to the Customer portal. A restricted key limits the damage if it ever leaks.
5. **Netlify environment variables** (Site configuration → Environment variables):
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the anon / public key
   - `STRIPE_SECRET_KEY` = the restricted key from step 4

   Then trigger a redeploy.
6. **Test:** go to mynextowner.com/login, sign in with the email you used for a test purchase, and check that the plan shows on /account.

## How it works

- Visitors log in with a one-time email link. Supabase verifies they own the email.
- The `membership` function confirms the login, then finds Stripe customers with that email and returns their active NextOwner plans (it reads the `tier` metadata on each Stripe price).
- Logged-in visitors get their email pre-filled at Stripe checkout, so new purchases land on the same account.
- Buyer Premium members see every Best Picks result; others see the top pick and an unlock prompt. Members with any plan don't get the auto-popup.

## Notes

- Supabase's built-in email sender has a low hourly limit. Before real traffic, connect a custom email sender (SMTP) in Supabase so sign-in links always arrive.
- Never put the Stripe key in any HTML or JS file. It belongs only in Netlify's environment variables.
