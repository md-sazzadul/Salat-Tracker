# Salah

A calm, mobile-friendly prayer journal built with React and TypeScript. It supports email/password and Google sign-in, stores each user's date of birth once, calculates a running prayer count, and saves daily check-ins to a private Supabase database.

The tracker treats the five daily salah (Fajr, Dhuhr, Asr, Maghrib, and Isha) as five prayer entries per day. The total is calculated from the saved date of birth through today, inclusive, less the entries marked complete. It tracks daily prayers rather than individual rakaʿah units.

## Free setup

The app can run at no charge with a Supabase Free project for accounts and data, and Cloudflare Pages Free hosting for the website. Supabase currently includes 50,000 monthly active users and 500 MB of database storage on Free, but pauses projects after a week without activity. Cloudflare Pages supports private and public GitHub repositories and currently allows 500 builds per month on its Free plan. Check the provider pages for current limits before launch: [Supabase pricing](https://supabase.com/pricing) and [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

### 1. Create a Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. In **Project Settings → API**, copy the project URL and publishable key (or legacy anon key). The app uses only this browser-safe key; row-level security policies protect the records. Never put a `service_role` key in this app.
4. In **Authentication → URL Configuration**, set the Site URL to your deployed app URL and add `http://localhost:5173` to the redirect URL allow list for local development.
5. In **Authentication → Sign In / Providers**, enable email sign-in. Supabase email confirmation can stay enabled; new users will confirm their email before returning to complete their profile.

**Email delivery note:** Supabase's built-in sender only sends to addresses in your Supabase organization and is limited to two emails per hour. To send confirmation messages to general users, configure a custom SMTP provider in Supabase Auth. Supabase supports custom SMTP on its Free plan, but the mail provider may have its own limits or require a verified sending domain. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp). Google sign-in does not depend on SMTP. As one current example, [Resend's free transactional-email tier](https://resend.com/pricing) allows 3,000 emails per month with a 100-per-day limit; its current provider requirements apply.

### 2. Set up Google sign-in

1. In Supabase, open **Authentication → Sign In / Providers → Google** and copy the callback URL shown there.
2. Create a **Web application** OAuth client in [Google Cloud Console](https://console.cloud.google.com/).
3. Add the deployed site origin and `http://localhost:5173` as authorized JavaScript origins. Add the Supabase callback URL as an authorized redirect URI.
4. Copy the Google client ID and secret into the Supabase Google provider settings and enable the provider.

### 3. Run locally

Use Node.js 20.19 or newer in the 20.x line, or 22.12 or newer in the 22.x line.

```sh
npm install
Copy-Item .env.example .env
```

Open `.env` and replace the sample values:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Then start the development server:

```sh
npm run dev
```

The same public key and URL are used in the browser. Keep all Supabase secret and service-role keys out of `.env` values that start with `VITE_`.

### 4. Publish for free with Cloudflare Pages

1. Push this project to a GitHub repository. It can stay private.
2. In Cloudflare, open **Workers & Pages → Create → Pages → Connect to Git** and select the repository.
3. Choose **Vite** if offered as a framework preset. Use `npm run build` as the build command and `dist` as the output directory. Set `NODE_VERSION` to `22.12.0` in the build environment.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the Pages project's production environment variables. Add them to preview variables too if you want to test preview deployments.
5. Deploy. Copy the `*.pages.dev` address into Supabase's Site URL and allowed redirect URL list. Add the same site origin to the Google OAuth client.

Cloudflare automatically rebuilds and publishes the connected branch after each push. See the [Cloudflare Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/) for the current dashboard steps.

Cloudflare Pages serves the responsive website over HTTPS. On a phone, open the published link in its browser; the layout adapts to a narrow screen. No separate mobile app is required.

## Privacy and data rules

- A user's date of birth is saved once in `profiles`. The schema intentionally has no profile update policy, so the app cannot change it after the first save.
- Prayer completion rows are scoped to the authenticated account using Supabase row-level security.
- The app sends only prayer dates, prayer names, and account identifiers to Supabase. It does not collect prayer times or location.
- Account deletion is handled from the Supabase Auth dashboard; deleting an auth user cascades to their profile and prayer records.

## Project structure

```text
src/
  App.tsx                 Screens, authentication flow, calendar, and check-ins
  lib/date.ts             Local date and count helpers
  lib/salah.ts            Daily prayers and completion types
  lib/supabase.ts         Supabase browser client
  styles.css              Responsive layout and visual styling
supabase/schema.sql       Tables and row-level security policies
```

