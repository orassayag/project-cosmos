# Stage 2 — Fork wording removal and "Origin & credits" (README, SECURITY)

## Plan section (paste)
### 2. Fork wording and credits (I4)
- Replace `README.md:8-12` ("About this fork") and `README.md:402` ("This repository is a fork of") with a single "Origin & credits" section: originally based on [ludeo-labs/cosmos-os](https://github.com/ludeo-labs/cosmos-os), MIT, original notice preserved in `LICENSE`, plus what was added (incidents, blast radius, health, ownership, drift, AI agent, demo tours). Keep the Medium post link.
- `README.md:348` and `SECURITY.md:13`: "off by default on forks" → "off by default".
- Verify: `grep -rniE "fork" README.md SECURITY.md` returns only intentional credit wording; no test layer (docs).

Scope context: Ludeo copyright line and MIT text must never change. Out of scope: any drift-sync gating change, renaming, GitHub edits.
Line numbers are approximate — locate by text. Also fix the README License footer only if it conflicts with LICENSE (LICENSE now lists Ludeo and Or Assayag; README footer `[MIT](LICENSE) © Ludeo` should credit both). The "Origin & credits" section may be one place (replace the top blockquote with a short one-line pointer if needed, but no text may still call the repo a fork).
Sizing: README.md and SECURITY.md only.
