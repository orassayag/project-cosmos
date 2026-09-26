# Stage 20 — needs a human

## 1. Acceptance steps 3–8 need a real Claude key (and a server secret first)

Steps 3–8 (connect with a good key → green, refresh stays green, weather joke, "play the checkout flow",
"what happens when a payment fails?" with ≥2 glowing services + usage line, disconnect → red) need a working
Claude API key. The agent never looks for or invents keys, so they are **NOT RUN**.

They also cannot pass yet: `AI_COOKIE_SECRET` is **not set for Preview** on the Vercel project — every
cookie route on the preview answers `503 { "errorCode": "AI_NOT_CONFIGURED" }`. Set it first
(plan's manual one-time step), then redeploy a preview:

```bash
openssl rand -base64 32
```

Add the output as `AI_COOKIE_SECRET` (Preview + Production) in Vercel project settings, and set a budget
on the AI Gateway key.

Then either:
- give a key to a follow-up run of steps 3–8, or
- run steps 3–8 yourself on a fresh preview (`vercel deploy`), at 390×844 and then desktop.

## 2. Decision: `vercel dev` shows a blank map (acceptance step 10b fails)

The `client` service rewrite in `vercel.json` (`/(.*)` → `/index.html`) is also applied by `vercel dev`
before proxying to Vite, so `/@vite/client`, `/@react-refresh` and `/src/main.tsx` are all rewritten to
`index.html` → Vite 500s and the page is blank. Verified on a fresh clone; removing that one rewrite
makes `vercel dev -L` load the map (AI reported not configured, as required).

The app only uses query-string deep links and the Pages redirect always lands on `/` + query, so the
SPA rewrite looks unnecessary — but it is plan-specified (§2), so the agent did not remove it.
Choose: (a) drop the `client` service `rewrites`, (b) keep it and accept `npm run dev:client` as the
only local path, or (c) something else.
