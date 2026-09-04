# Claim Helper

A very small web app for handing out comments, YouTube links, and TikTok links one at a time.

## What It Does

- Public users click `Get Comment`, `Get YouTube Link`, or `Get TikTok Link`.
- The app gives them the next unused item from that list.
- Once an item is claimed, it is marked used.
- The same IP address can claim one item per type per hour.
- Admin pages let you add lists, replace lists, search lists, clear used items, copy rows, export the claim log, and check usage.

## Run Locally

From this project folder:

```bash
node server.js
```

If your computer does not have normal `node` installed, use the bundled Codex Node:

```bash
/Users/luke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

Then open:

```text
http://localhost:3000
```

Public page:

```text
http://localhost:3000/
```

Admin dashboard:

```text
http://localhost:3000/admin.html
```

Admin login:

```text
http://localhost:3000/admin-login.html
```

## Admin Pages

The admin dashboard has four sections:

```text
http://localhost:3000/admin-section.html?section=comments
http://localhost:3000/admin-section.html?section=youtubeLinks
http://localhost:3000/admin-section.html?section=tiktokLinks
http://localhost:3000/admin-section.html?section=logs
```

The claim log is view-only. It does not have Add More, Replace, or Clear Used.

## Admin Password

For local testing, the admin area is open unless `ADMIN_PASSWORD` is set.

When hosted, set this environment variable:

```bash
ADMIN_PASSWORD=choose-a-private-password
```

Then go to:

```text
/admin-login.html
```

Enter your password once. The browser remembers it locally.

## Add More Vs Replace

Use `Add More` for normal work.

`Add More`:

- Adds pasted items to the end of the current list.
- Keeps used items used.
- Keeps unused items unused.
- Skips duplicates already in that list.
- Skips duplicates inside the pasted batch.
- Does not change the claim log.

Use `Replace` only when you want to reset that section's active list.

`Replace`:

- Removes every current item from that section.
- Adds the pasted items as a fresh new list.
- Makes every new item unused.
- Does not delete the claim log.
- Shows a confirmation warning first.

Example:

Current comments:

```text
A - used
B - unused
C - unused
```

If you click `Add More` with:

```text
D
E
```

The list becomes:

```text
A - used
B - unused
C - unused
D - unused
E - unused
```

If you click `Replace` with:

```text
D
E
```

The list becomes:

```text
D - unused
E - unused
```

The old active items are gone, but the claim log still keeps history.

## Clear Used

Use `Clear Used` when a section is getting cluttered.

It removes only used items from that active list. Unused items stay. The claim log stays.

## Search

Each admin section page has a search box.

Search works on:

- Item text
- Claim type
- IP address
- User agent
- Claim date

## Pagination

Admin list pages show 100 rows at a time. Use `Previous` and `Next` at the bottom when there are more than 100 matching rows.

This keeps the admin pages usable when you have hundreds or thousands of rows.

## Copy Buttons

Each row has a `Copy` button.

Use it to copy a comment, YouTube link, TikTok link, or claim log value.

## Export Claim Log

Open the claim log page:

```text
/admin-section.html?section=logs
```

Click `Export CSV`.

This downloads:

```text
claim-log.csv
```

The CSV includes:

- claimedAt
- type
- value
- ip
- userAgent
- itemId
- id

## One Claim Per Hour

The app limits each IP address to one claim per hour for each type.

Someone can claim:

- 1 comment per hour
- 1 YouTube link per hour
- 1 TikTok link per hour

To change the cooldown, set:

```bash
CLAIM_COOLDOWN_MS=3600000
```

Examples:

```bash
CLAIM_COOLDOWN_MS=3600000
```

One hour.

```bash
CLAIM_COOLDOWN_MS=300000
```

Five minutes.

## Data Storage

Local data is stored here:

```text
data/store.json
```

Hosted data should be stored on persistent storage, such as a Railway Volume.

Do not manually edit `store.json` while the server is running.

## Simple Hosting Checklist

Recommended host: Railway.

1. Create a GitHub account.
2. Create a GitHub repo named something like `claim-helper`.
3. Upload this project to GitHub.
4. Create a Railway account.
5. Click `New Project`.
6. Choose `Deploy from GitHub repo`.
7. Pick your `claim-helper` repo.
8. Let Railway deploy it.
9. In Railway, generate a public domain.
10. Add a Railway Volume.
11. Attach the Volume to your app.
12. Use mount path:

```text
/data
```

13. Add Railway variable:

```text
ADMIN_PASSWORD
```

14. Set it to a private password.
15. Open your public Railway URL.
16. Open `/admin-login.html`.
17. Log in.
18. Add your real comments and links.

## Can This Be Free?

Yes, for a small app.

You can use Railway's free hosted URL instead of buying a domain:

```text
https://your-app-name.up.railway.app
```

A custom domain like `yourbrand.com` usually costs money.

Important: use persistent storage. If the host deletes local files on restart, your used/unused tracking can disappear.

## Ongoing Upkeep Checklist

Daily or before sharing the public link:

1. Open `/admin.html`.
2. Check available counts.
3. Add more items before any section hits zero.
4. Test the public page once.
5. Remember your own test claim uses one item.

Weekly:

1. Export the claim log CSV.
2. Save the CSV somewhere safe if you need records.
3. Clear used items from busy sections.
4. Check for duplicate or bad links.
5. Check for weird repeated IPs in the claim log.

Before a new campaign:

1. Decide whether you want to append or reset.
2. Use `Add More` to keep existing unused items.
3. Use `Replace` only if you want a fresh list.
4. Verify counts on `/admin.html`.
5. Open each section and search for obvious bad entries.

If something looks wrong:

1. Do not click Replace unless you mean it.
2. Export the claim log first.
3. Check `data/store.json` or your Railway Volume data.
4. Restart the app if the page seems stale.
5. Hard-refresh your browser with `Command + Shift + R`.

## API

- `GET /api/status` returns available and used counts.
- `POST /api/claim/comment` claims the next unused comment.
- `POST /api/claim/youtube` claims the next unused YouTube link.
- `POST /api/claim/tiktok` claims the next unused TikTok link.
- `GET /api/admin/store` returns comments, links, and logs.
- `GET /api/admin/export/logs.csv` downloads the claim log.
- `POST /api/admin/add` adds new items to one list.
- `POST /api/admin/replace` replaces one list.
- `POST /api/admin/clear-used` removes used items from one list.

Valid list types:

```text
comments
youtubeLinks
tiktokLinks
```
