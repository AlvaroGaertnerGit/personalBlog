# Personal AI Website

Álvaro Gaertner's personal portfolio. Next.js (App Router), React, TypeScript, Tailwind CSS v4, Framer Motion.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and fill in the values below before testing the Contact section.

## Contact section — email setup (Resend)

The Contact section sends two real emails through [Resend](https://resend.com) when a visitor submits the form:

1. **Internal notification** — to you (`CONTACT_TO_EMAIL`), with the visitor's message and their address set as Reply-To, so replying goes straight to them.
2. **Visitor confirmation** — to the visitor, confirming their message arrived.

### Required environment variables

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | API key from your [Resend dashboard](https://resend.com/api-keys). |
| `CONTACT_TO_EMAIL` | Your own inbox — where the internal notification lands. Any real mailbox works. |
| `CONTACT_FROM_EMAIL` | The sending identity for both emails, e.g. `Scope <contact@alvarogaertner.com>`. The domain in the address must be verified in Resend first (see below). |

If any of these are missing, the app never crashes: `/api/contact` logs a clear server-side error naming the missing variable(s) and returns a `500` response. Nothing is ever hardcoded as a fallback — set these explicitly wherever the app runs.

`.env.local` example:

```bash
RESEND_API_KEY=re_your_key_here
CONTACT_TO_EMAIL=alvarogaertnerufv18@gmail.com
CONTACT_FROM_EMAIL=Scope <contact@alvarogaertner.com>

# Optional, local dev only — bypasses Resend and simulates a successful send
CONTACT_SIMULATE_SUCCESS=true
```

### Verifying your sending domain

Resend only accepts sends from a verified domain — `CONTACT_FROM_EMAIL`'s domain must be verified before it will work.

1. In the [Resend dashboard](https://resend.com/domains), click **Add Domain** and enter your domain (e.g. `alvarogaertner.com`).
2. Resend gives you a set of DNS records (SPF, DKIM, and optionally DMARC). Add them at your domain registrar/DNS provider.
3. Wait for DNS propagation, then click **Verify** in the Resend dashboard. Status turns green once verified.
4. Set `CONTACT_FROM_EMAIL` to any address at that verified domain, e.g. `Scope <contact@alvarogaertner.com>`.

Until the domain is verified, sends from it fail — Resend's own sandbox sender (`onboarding@resend.dev`) is not used anywhere in this codebase.

### Deploying on Vercel

1. Import the repository into [Vercel](https://vercel.com/new).
2. In **Project Settings → Environment Variables**, add `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and `CONTACT_FROM_EMAIL` for the Production (and Preview, if desired) environment. Vercel does not read `.env.local` — these must be set here.
3. Deploy. No code changes are needed between environments — the same build reads whichever variables are configured.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Deploying Next.js on Vercel](https://nextjs.org/docs/app/building-your-application/deploying)
