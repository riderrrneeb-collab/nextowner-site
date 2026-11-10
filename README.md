# NextOwner website

Static pages plus three small Netlify Functions that power member logins.

| File | What it is |
|---|---|
| `public/index.html` | Marketplace preview, Best Picks finder, subscription prompt |
| `public/pricing.html` | Plans with Stripe checkout links |
| `public/login.html` | Email sign-in link (no passwords), via Supabase |
| `public/account.html` | Member's plans from Stripe + "Manage billing and plans" |
| `public/auth.js`, `public/account.css` | Shared login helper and styles |
| `public/sell.html` | Create and edit a listing (sellers with a plan; admins any time) |
| `public/admin.html` | Admin: verify, hide, edit or delete any listing |
| `netlify/functions/` | `config` (public Supabase settings), `membership` (looks up plans in Stripe), `portal` (opens Stripe billing) |
| `netlify.toml` | Tells Netlify where the site and functions live |

## One-time setup

1. **GitHub:** create a repository (for example `nextowner-site`) and upload every file and folder here, keeping the `netlify` folder structure.
2. **Netlify:** link your existing mynextowner.com site to that repository. Leave the build command empty; the publish directory is `.` (set in `netlify.toml`). Every push to GitHub now deploys automatically.
3. **Supabase** (free): create a project. Under Authentication → URL Configuration, set the Site URL to `https://mynextowner.com` and add `https://mynextowner.com/account` as a redirect URL. From the project's API settings, copy the **Project URL** and the **publishable** key (starts with `sb_publishable_`). A legacy anon key also works.
4. **Stripe:** in Developers → API keys, create a **restricted key** with **Customers: Read**, **Subscriptions: Read** and **Customer portal: Write**, everything else None. A restricted key limits the damage if it ever leaks.
5. **Netlify environment variables** (Site configuration → Environment variables):
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_PUBLISHABLE_KEY` = the publishable key (or `SUPABASE_ANON_KEY` = a legacy anon key)
   - `STRIPE_SECRET_KEY` = the restricted key from step 4

   Then trigger a redeploy.
6. **Sign-in codes:** in Supabase, Authentication → Email Templates, add `Your code: {{ .Token }}` to the **Magic Link** template (and the **Confirm signup** template, which first-time users may get). Visitors can then type the code on the tab they started from instead of clicking the link.
7. **Google sign-in (optional):** set up Google in Supabase (Authentication → Sign In / Providers → Google), then add `GOOGLE_LOGIN` = `on` in Netlify and redeploy. The "Continue with Google" button stays hidden until then.
8. **Test:** go to mynextowner.com/login, sign in with the email you used for a test purchase, and check that the plan shows on /account.

## How it works

- Visitors log in with a one-time email link. Supabase verifies they own the email.
- The `membership` function confirms the login, then finds Stripe customers with that email and returns their active NextOwner plans (it reads the `tier` metadata on each Stripe price).
- Logged-in visitors get their email pre-filled at Stripe checkout, so new purchases land on the same account.
- Buyer Premium members see every Best Picks result; others see the top pick and an unlock prompt. Members with any plan don't get the auto-popup.

## Notes

- Supabase's built-in email sender has a low hourly limit. Before real traffic, connect a custom email sender (SMTP) in Supabase so sign-in links always arrive.
- Never put the Stripe key in any HTML or JS file. It belongs only in Netlify's environment variables.

## Listings

- Listings and photos are stored in Netlify Blobs (stores `listings` and `listing-photos`); nothing to set up.
- Anyone logged in can build a listing and save it as a draft (max 3 drafts). Publishing needs a seller plan; extra photos (5 / 12 / 20 by plan), higher placement and social promotion are paywalled in the form.
- Each active seller plan allows one live listing. If a plan is canceled, the daily `sync-listings` job takes the listing offline; it comes back when the plan is renewed.
- Seller contact details are only returned to logged-in visitors (`/api/contact/:id`).
- ID verification uses Stripe Identity (photo ID + selfie, `/api/verify`). Turn on Identity in the Stripe Dashboard and give the restricted key **write** access to Identity verification sessions. Verified sellers' listings get the ✓ Verified badge automatically; the daily job finishes checks that were still processing.
- Admins (mynextownerofficial@gmail.com, plus any emails in the `ADMIN_EMAILS` variable, comma-separated) can create listings without a plan and verify, hide or delete any listing at /admin.
- Example listings fill the homepage until there are 6 real ones, and are labeled "Example".
