# GBA Pulse — Cloud Run 3: Happenings calendar

You are a **cloud agent** on repo `sara-hoilam/the-bay-trending-topics` (branch `main`). **Runs 1–2** should have updated Trend Watch and Daily Brief.

## Deliverable

Refresh **`happenings-events.json`** with upcoming lifestyle events for the **Happenings** tab, then commit and push **`main`**.

## Required steps

1. Run the automated fetch (Amazing Shenzhen listings):

   ```bash
   node scripts/generate-happenings-data.mjs
   ```

2. Browse **lifestyle sources** from `source-links-data.json` (category **Lifestyle**) and add or update events **not** covered by the script:

   | Domain | Focus |
   |--------|--------|
   | `event.hktdc.com` | HK trade fairs & expos (next 90 days) |
   | `westk.hk` | M+, Palace Museum, performing arts |
   | `10times.com` | Shenzhen trade shows |
   | `shenzhenmuseum.com` | Museum exhibitions |

3. Each event object:

   ```json
   {
     "title": "Short headline",
     "start": "YYYY-MM-DD",
     "end": "YYYY-MM-DD",
     "region": "hk|shenzhen|macao|gba|international",
     "location": "City or venue area",
     "url": "https://…",
     "sourceDomain": "event.hktdc.com"
   }
   ```

   **Region rules:** Hong Kong → `hk`; Shenzhen → `shenzhen`; Macao → `macao`; other GBA cities (Guangzhou, Foshan, etc.) → `gba`; outside GBA (e.g. France/VivaTech) → `international`.

4. Keep **8–20 upcoming events** (end date ≥ today HKT). Remove events that ended more than 14 days ago. Do **not** duplicate the same fair under multiple titles.

5. Set top-level `updatedAt` to **today’s date** (HKT, `YYYY-MM-DD`).

6. **Commit and push to `main`**:

   ```bash
   git add happenings-events.json
   git commit -m "daily: Happenings refresh $(TZ=Asia/Hong_Kong date +%Y-%m-%d)"
   git push origin main
   ```

Use `GITHUB_TOKEN` if needed for push.

## Do not

- Edit `index.html` or briefing fragments (Happenings loads JSON client-side).
- Invent events without a source URL on an approved lifestyle domain.
- Open PRs — push directly to `main`.

## Cost discipline

- One pass per lifestyle source; prefer official event calendars over generic news search.
- Merge with script output — do not wipe curated HKTDC/WestK rows unless dates have passed.
