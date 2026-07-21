// Shared Supabase client + data helpers for Ikbel Coaching.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Register the service worker so the app can be installed to the home screen.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// ---- auth helpers ----
export async function currentUser() {
  const { data } = await sb.auth.getUser();
  return data.user || null;
}

export async function myProfile() {
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function signOut() {
  await sb.auth.signOut();
  location.href = "index.html";
}

// ---- small utilities ----
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function weekStartISO(d = new Date()) {
  // Monday as start of week, matching date_trunc('week') in Postgres.
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("ar-TN", {
    day: "numeric",
    month: "short",
  });
}

// Escape user text before inserting into innerHTML.
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
