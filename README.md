# Splitplus

Shared expense tracking for a group of friends, a flat, or a trip. Equal, exact
and percentage splits, and the same numbers on every device you log in from.

Built with Next.js (static export) and backed by a Google Sheet you own — there
is no server to run.

## Setup

Everything (accounts, groups, expenses) lives in **one** Google Sheet. You set it
up once.

1. Create a new Google Sheet.
2. **Extensions → Apps Script**, and paste in the contents of
   [`public/google_apps_script.js`](public/google_apps_script.js), replacing
   whatever is there. (The app also shows this code under **Profile → View the
   Google Apps Script**.)
3. Run the `setup` function once. It creates the `Users`, `Groups` and
   `Expenses` tabs.
4. **Deploy → New deployment → Web app**, with:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
5. Copy the web app URL into `.env`:

   ```
   NEXT_PUBLIC_AUTH_SHEET_URL=https://script.google.com/macros/s/…/exec
   ```

6. `npm install && npm run dev`

Without `NEXT_PUBLIC_AUTH_SHEET_URL` the app still runs, but accounts and groups
stay in that one browser — no sync, and no invites.

### Updating the script later

Use **Deploy → Manage deployments → edit → New version**, not "New deployment",
so the URL stays the same and you don't have to change `.env`.

## How syncing works

The sheet is the source of truth; `localStorage` is a cache so the app opens
instantly and survives a dead signal.

- On login, and every 20 seconds a page is open and visible, the app pulls
  everything the account can see in one request (`GET_USER_DATA`).
- Membership changes (invite, accept, decline, approve, reject, leave) are
  applied *server-side* under a script lock, so two people acting at once can't
  overwrite each other with stale member lists.
- Expenses are one row each, written and deleted individually, so concurrent
  edits in different groups never collide.

## Security

**The script has no per-user authorization.** Anyone with the web app URL can
read every row in the sheet — all accounts, groups and expenses, not just their
own. Treat the URL as being as sensitive as the sheet itself, and don't put
anything in it you wouldn't share with everyone in your groups.

Passwords are SHA-256 hashed in the browser; the plaintext never leaves the
device, and only the hash is stored. That is not a substitute for the above:
a hash is not a password, but the rest of the sheet is readable regardless.

Deleting an account removes its row, frees the username, and drops the user from
every group. Expenses are deliberately left intact so nobody else's balance
silently shifts.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Static export to `out/` |
| `npm run lint` | ESLint |
