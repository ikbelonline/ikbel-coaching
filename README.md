# Ikbel Coaching

A nutrition **client-monitoring system** for the coach. Two apps sharing one
Supabase backend:

- **Client app** (`index.html`) — members install it to their phone and log
  weight & measurements, progress photos, daily diet adherence, and a weekly
  check-in.
- **Coach dashboard** (`coach.html`) — you see every client, their trends,
  status flags (active / quiet / checked-in), photos, and you reply with
  feedback the client sees in their app.

It's a **PWA** (installs to the home screen like a real app), pure static
HTML/JS — no build step. Backend is Supabase (database + login + photo storage).

---

## Status

✅ Backend live and verified (project `xzvyclqbgozhdhrvspgr`, EU-Ireland).
✅ Client app + coach dashboard built and tested end-to-end.
⏳ Not yet deployed to the public web (runs locally for now — see *Deploy*).

## How the pieces fit

| File | What it is |
|------|-----------|
| `index.html` + `client.js` | the client (member) app |
| `coach.html` + `coach.js` | the coach dashboard |
| `db.js` | shared Supabase client + helpers |
| `config.js` | your Supabase URL + publishable key |
| `styles.css` | shared styling |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA install support |
| `db/*.sql` | the database setup (already applied) |
| `serve.ps1` | local preview server (`powershell -File serve.ps1`) |

## Run it locally

```powershell
powershell -ExecutionPolicy Bypass -File app\serve.ps1 -Port 8150
```
then open http://localhost:8150

## Becoming the coach

Everyone who signs up is a **client** by default. To make YOUR account the
coach, sign up once in the app with your real email, then run this in the
Supabase SQL editor (replace the email):

```sql
update public.profiles set role = 'coach'
 where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
```

## Adding clients (two ways)

1. **You create them** — in the coach dashboard, *Add a client* with their name,
   email, and a temporary password. Share those with the client. They appear
   immediately.
2. **They self-register** — a client signs up in the app themselves. To attach
   them to you, either use *Add a client* with the same email, or run:
   `update public.profiles set coach_id = (select id from auth.users where email='COACH-EMAIL') where id = (select id from auth.users where email='CLIENT-EMAIL');`

## Deploy (to make it installable on phones)

The app needs HTTPS hosting for clients to install it. Recommended: **Netlify**
(same as the other Ikbel sites). Drag-and-drop the `app/` folder onto
netlify.com/drop, or connect a GitHub repo for auto-deploy. Once live, clients
open the URL and tap *Add to Home Screen*.

## Test accounts (safe to delete)

Created during testing — delete anytime in Supabase → Authentication → Users:
- `coach@example.com` / `coachpass` (was promoted to coach)
- `testclient@example.com` / `test1234`
- `newclient@example.com` / `sara1234`
