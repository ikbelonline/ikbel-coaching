# Ikbel Coaching — Setup guide (do this once)

Follow these steps in order. Takes about 10 minutes. You only click through
web dashboards — there is nothing to install on your PC.

---

## Step 1 — Create a free Supabase account
1. Go to **https://supabase.com** → **Start your project** → sign in with your
   Google account (`ikbel.online@gmail.com`) or email.
2. Click **New project**.
   - **Name:** `ikbel-coaching`
   - **Database password:** click *Generate a password*, then **copy it and
     save it somewhere safe** (you rarely need it, but don't lose it).
   - **Region:** pick the closest one (Europe — e.g. *West EU (Ireland)* or
     *Frankfurt* — is closest to Tunisia).
3. Click **Create new project** and wait ~2 minutes while it sets up.

## Step 2 — Create the database tables
1. In the left sidebar open **SQL Editor** → **New query**.
2. Open the file `db/schema.sql` from this project, copy **everything**, paste
   it into the editor, and click **Run** (bottom right).
3. You should see *Success. No rows returned*. ✅

## Step 3 — Create the photo storage bucket
1. Left sidebar → **Storage** → **New bucket**.
2. Name it exactly: `photos`  — leave **Public** toggle **OFF** (keep private).
3. Click **Save**.

## Step 4 — Add the storage security rules
1. Back to **SQL Editor** → **New query**.
2. Open `db/storage-policies.sql`, copy everything, paste, **Run**. ✅

## Step 5 — Grab your project keys (I need these to build the app)
1. Left sidebar → **Project Settings** (gear icon) → **API**.
2. Copy these two values and paste them back to me in the chat:
   - **Project URL**  (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key  (a long string under *Project API keys*)

   > These two are safe to put in a website — the `anon` key is designed to be
   > public and is protected by the security rules we just added. **Do NOT** send
   > me the `service_role` key or your database password.

## Step 6 — (We'll do this together after you sign up in the app)
Once the client app exists, you'll create your own login, then run one tiny SQL
command to mark yourself as the **coach**. I'll give you that command when we
get there.

---

### What to send me now
After Step 5, paste into the chat:
```
URL:  https://xxxxx.supabase.co
anon: eyJhbGciOi....(long string)
```
Then I'll wire up the Ikbel Coaching app to your database and we'll test it
with a fake client.
