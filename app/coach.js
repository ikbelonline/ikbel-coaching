// Ikbel Coaching — coach dashboard logic  [Tunsi UI]
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { sb, myProfile, signOut, weekStartISO, fmtDate, esc } from "./db.js";

const $ = (id) => document.getElementById(id);
let me = null;

const POSE_AR = { front: "قدّام", side: "جنب", back: "ورا" };
const MEAL_AR = { breakfast: "فطور", lunch: "غداء", dinner: "عشاء", snack: "سناك" };

function toast(msg, isErr = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (isErr ? " err" : "");
  setTimeout(() => (t.className = "toast"), 2600);
}

$("signout").onclick = signOut;
$("back").onclick = () => { $("detailView").classList.add("hide"); $("listView").classList.remove("hide"); };

async function boot() {
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) { location.href = "index.html"; return; }
  me = await myProfile();
  if (!me || me.role !== "coach") {
    $("gate").classList.remove("hide");
    $("listView").classList.add("hide");
    return;
  }
  await loadClients();
}

// ---------------- CLIENT LIST ----------------
let clients = [];
async function loadClients() {
  const { data, error } = await sb.from("profiles").select("*").eq("coach_id", me.id).order("full_name");
  if (error) return toast(error.message, true);
  clients = data || [];
  const list = $("clientList");
  list.innerHTML = "";
  $("noClients").classList.toggle("hide", clients.length > 0);

  const wk = weekStartISO();
  const ids = clients.map((c) => c.id);
  let checkins = [], recentAdh = [];
  if (ids.length) {
    const [{ data: ci }, { data: ad }] = await Promise.all([
      sb.from("checkins").select("client_id,week_start").in("client_id", ids).eq("week_start", wk),
      sb.from("adherence").select("client_id,date").in("client_id", ids).order("date", { ascending: false }),
    ]);
    checkins = ci || []; recentAdh = ad || [];
  }
  const checkedIn = new Set(checkins.map((c) => c.client_id));
  const lastSeen = {};
  for (const a of recentAdh) if (!lastSeen[a.client_id]) lastSeen[a.client_id] = a.date;

  let stale = 0;
  for (const c of clients) {
    const seen = lastSeen[c.id];
    const days = seen ? Math.floor((Date.now() - new Date(seen)) / 86400000) : 999;
    const quiet = days >= 7;
    if (quiet) stale++;
    const statusPill = quiet
      ? `<span class="pill bad">ساكت ${seen ? days + " يوم" : ""}</span>`
      : `<span class="pill good">نشيط</span>`;
    const ciPill = checkedIn.has(c.id) ? `<span class="pill good">عمل متابعة</span>` : `<span class="pill warn">ما عملش متابعة</span>`;
    const initials = (c.full_name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
    const row = document.createElement("button");
    row.className = "clientrow";
    row.innerHTML = `<div class="avatar">${esc(initials)}</div>
      <div style="flex:1">
        <div style="font-weight:700">${esc(c.full_name || "بلا اسم")}</div>
        <div class="small" style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap">${statusPill}${ciPill}</div>
      </div><div class="muted">‹</div>`;
    row.onclick = () => openClient(c);
    list.appendChild(row);
  }

  $("k_clients").textContent = clients.length;
  $("k_checkins").textContent = checkedIn.size;
  $("k_stale").textContent = stale;
}

// ---------------- ADD CLIENT ----------------
$("addClient").onclick = async () => {
  const name = $("nc_name").value.trim();
  const email = $("nc_email").value.trim();
  const pass = $("nc_pass").value;
  if (!name || !email || pass.length < 6) return ($("nc_msg").textContent = "عمّر الاسم، الإيميل، و كلمة سر 6 حروف عالأقل.");
  $("addClient").disabled = true;
  $("nc_msg").textContent = "قاعد نعمل الحساب…";
  try {
    const tmp = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "ikbel-tmp" },
    });
    const { data, error } = await tmp.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
    if (error) throw error;
    const newId = data.user?.id;
    if (!newId) throw new Error("الحساب ما تعملش.");
    const { error: rpcErr } = await sb.rpc("add_my_client", { client: newId });
    if (rpcErr) throw rpcErr;
    $("nc_name").value = $("nc_email").value = $("nc_pass").value = "";
    $("nc_msg").textContent = "";
    toast("الحريف تزاد ✅ ابعثلو الإيميل و كلمة السر.");
    loadClients();
  } catch (e) {
    $("nc_msg").textContent = e.message || "ما نجّمناش نعملو الحريف.";
  } finally {
    $("addClient").disabled = false;
  }
};

// ---------------- CLIENT DETAIL ----------------
async function openClient(c) {
  $("listView").classList.add("hide");
  $("detailView").classList.remove("hide");
  window.scrollTo(0, 0);
  $("d_name").textContent = c.full_name || "حريف";
  $("d_goal").textContent = c.goal ? "🎯 " + c.goal : "";
  $("d_avatar").textContent = (c.full_name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  // weight
  const { data: weights } = await sb.from("weigh_ins").select("date,weight_kg").eq("client_id", c.id)
    .not("weight_kg", "is", null).order("date", { ascending: true });
  const bars = $("d_bars"); bars.innerHTML = "";
  if (weights && weights.length) {
    $("d_noWeight").classList.add("hide");
    const vals = weights.map((w) => w.weight_kg);
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const diff = vals[vals.length - 1] - vals[0];
    $("d_weight").textContent = vals[vals.length - 1] + " كغ";
    $("d_change").textContent = (diff > 0 ? "+" : "") + diff.toFixed(1) + " كغ";
    $("d_change").style.color = diff <= 0 ? "var(--brand)" : "var(--amber)";
    for (const w of weights.slice(-14)) {
      const b = document.createElement("div");
      b.className = "b"; b.style.height = (15 + ((w.weight_kg - min) / span) * 80) + "%";
      b.innerHTML = `<span>${w.weight_kg}</span><em>${fmtDate(w.date)}</em>`;
      bars.appendChild(b);
    }
  } else {
    $("d_noWeight").classList.remove("hide");
    $("d_weight").textContent = "–"; $("d_change").textContent = "–";
  }

  // adherence
  const { data: adh } = await sb.from("adherence").select("date,hit_plan").eq("client_id", c.id).order("date", { ascending: false }).limit(60);
  let streak = 0;
  if (adh) { for (const a of adh) { if (a.hit_plan) streak++; else break; } }
  $("d_streak").textContent = streak;
  const last30 = (adh || []).filter((a) => (Date.now() - new Date(a.date)) / 86400000 <= 30);
  const hit = last30.filter((a) => a.hit_plan).length;
  $("d_compliance").textContent = last30.length ? Math.round((hit / last30.length) * 100) + "%" : "–";

  // meals (last ~15)
  const { data: meals } = await sb.from("meals").select("*").eq("client_id", c.id).order("eaten_at", { ascending: false }).limit(15);
  const mbox = $("d_meals"); mbox.innerHTML = "";
  $("d_noMeals").classList.toggle("hide", !!(meals && meals.length));
  for (const m of meals || []) {
    let thumb = "";
    if (m.photo_path) {
      const { data: signed } = await sb.storage.from("photos").createSignedUrl(m.photo_path, 3600);
      if (signed?.signedUrl) thumb = `<img src="${signed.signedUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:9px;flex:none">`;
    }
    const when = new Date(m.eaten_at).toLocaleDateString("ar-TN", { day: "numeric", month: "short" }) + " " +
                 new Date(m.eaten_at).toLocaleTimeString("ar-TN", { hour: "2-digit", minute: "2-digit" });
    const el = document.createElement("div");
    el.style.cssText = "display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)";
    el.innerHTML = `${thumb}
      <div style="flex:1">
        <div style="font-weight:600"><span class="pill">${esc(MEAL_AR[m.meal_type] || "")}</span> ${esc(m.description || "")}</div>
        <div class="small muted">${when}${m.calories ? " · " + m.calories + " كالوري" : ""}</div>
      </div>`;
    mbox.appendChild(el);
  }

  // latest check-in
  const { data: ci } = await sb.from("checkins").select("*").eq("client_id", c.id).order("week_start", { ascending: false }).limit(1).maybeSingle();
  const box = $("d_checkin");
  if (ci) {
    box.innerHTML = `<p class="muted small">جمعة ${fmtDate(ci.week_start)}</p>
      <div class="stats">
        <div class="stat"><div class="n">${ci.sleep ?? "–"}</div><div class="l">النوم</div></div>
        <div class="stat"><div class="n">${ci.energy ?? "–"}</div><div class="l">الطاقة</div></div>
        <div class="stat"><div class="n">${ci.hunger ?? "–"}</div><div class="l">الجوع</div></div>
        <div class="stat"><div class="n">${ci.mood ?? "–"}</div><div class="l">المزاج</div></div>
      </div>
      ${ci.notes ? `<p style="margin-top:10px"><strong>الملاحظات:</strong> ${esc(ci.notes)}</p>` : ""}`;
    $("d_feedback").value = ci.coach_feedback || "";
    $("d_saveFeedback").onclick = () => saveFeedback(c.id, ci.week_start);
  } else {
    box.innerHTML = `<p class="muted small">مازال ما فماش متابعة.</p>`;
    $("d_feedback").value = "";
    $("d_saveFeedback").onclick = () => toast("مازال ما فماش متابعة باش تزيد عليها ملاحظات.", true);
  }

  // photos
  const { data: photos } = await sb.from("photos").select("*").eq("client_id", c.id).order("created_at", { ascending: false }).limit(12);
  const grid = $("d_photos"); grid.innerHTML = "";
  $("d_noPhotos").classList.toggle("hide", !!(photos && photos.length));
  for (const p of photos || []) {
    const { data: signed } = await sb.storage.from("photos").createSignedUrl(p.storage_path, 3600);
    const cell = document.createElement("div");
    cell.innerHTML = `<img src="${signed?.signedUrl || ""}" alt="${esc(p.pose)}"><div class="photo-tag">${esc(POSE_AR[p.pose] || p.pose)} · ${fmtDate(p.date)}</div>`;
    grid.appendChild(cell);
  }
}

async function saveFeedback(clientId, week) {
  const { error } = await sb.from("checkins").update({ coach_feedback: $("d_feedback").value.trim() || null })
    .eq("client_id", clientId).eq("week_start", week);
  if (error) return toast(error.message, true);
  toast("الملاحظات تبعثت 💬");
}

boot();
