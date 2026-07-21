// Ikbel Coaching — client (member) app logic  [Tunsi UI]
import { sb, myProfile, signOut, todayISO, weekStartISO, fmtDate, esc } from "./db.js";

const $ = (id) => document.getElementById(id);
let profile = null;

const POSE_AR = { front: "قدّام", side: "جنب", back: "ورا" };
const MEAL_AR = { breakfast: "فطور", lunch: "غداء", dinner: "عشاء", snack: "سناك" };

function toast(msg, isErr = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (isErr ? " err" : "");
  setTimeout(() => (t.className = "toast"), 2200);
}

// ---------------- AUTH ----------------
let mode = "signin"; // or "signup"

function renderAuthMode() {
  $("authTitle").textContent = mode === "signin" ? "دخول" : "اعمل حسابك";
  $("authBtn").textContent = mode === "signin" ? "دخول" : "اعمل الحساب";
  $("nameField").classList.toggle("hide", mode === "signin");
  $("authSwitchText").textContent = mode === "signin" ? "حريف جديد؟" : "عندك حساب؟";
  $("authSwitch").textContent = mode === "signin" ? "اعمل حساب" : "ادخل";
  $("password").autocomplete = mode === "signin" ? "current-password" : "new-password";
  $("authMsg").textContent = "";
}

$("authSwitch").onclick = (e) => {
  e.preventDefault();
  mode = mode === "signin" ? "signup" : "signin";
  renderAuthMode();
};

$("authBtn").onclick = async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return ($("authMsg").textContent = "دخّل الإيميل و كلمة السر.");
  $("authBtn").disabled = true;
  $("authMsg").textContent = "استنّى شويّة…";
  try {
    if (mode === "signup") {
      const full_name = $("fullName").value.trim();
      const { error } = await sb.auth.signUp({
        email, password, options: { data: { full_name } },
      });
      if (error) throw error;
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session) {
        mode = "signin"; renderAuthMode();
        $("authMsg").textContent = "الحساب تعمل — تنجّم تدخل توّا.";
        return;
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    await boot();
  } catch (e) {
    $("authMsg").textContent = e.message || "صار مشكل، عاود من فضلك.";
  } finally {
    $("authBtn").disabled = false;
  }
};

$("signout").onclick = signOut;

// ---------------- APP BOOT ----------------
async function boot() {
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) {
    $("auth").classList.remove("hide");
    $("app").classList.add("hide");
    renderAuthMode();
    return;
  }
  profile = await myProfile();

  if (profile && profile.role === "coach") {
    location.href = "coach.html";
    return;
  }

  $("auth").classList.add("hide");
  $("app").classList.remove("hide");
  const first = (profile?.full_name || "بيك").split(" ")[0];
  $("hiName").textContent = "أهلا " + first;
  $("todayDate").textContent = new Date().toLocaleDateString("ar-TN", { weekday: "long", day: "numeric", month: "long" });
  $("weekLabel").textContent = "جمعة " + fmtDate(weekStartISO());

  await Promise.all([loadToday(), loadMeals(), loadPhotos(), loadCheckin(), loadProgress()]);
}

// ---------------- TABS ----------------
document.querySelectorAll(".tabbar button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll(".tabbar button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".tab").forEach((s) => s.classList.add("hide"));
    $("tab-" + b.dataset.tab).classList.remove("hide");
  };
});

// ---------------- TODAY: adherence ----------------
async function loadToday() {
  const uid = profile.id;
  const { data } = await sb.from("adherence").select("*").eq("client_id", uid).eq("date", todayISO()).maybeSingle();
  if (data) {
    setAdhereUI(data.hit_plan);
    $("adhereNote").value = data.notes || "";
  }
  const { data: last } = await sb.from("weigh_ins").select("*").eq("client_id", uid).order("date", { ascending: false }).limit(1).maybeSingle();
  if (last) {
    for (const [k, field] of [["weight_kg","w_weight"],["waist_cm","w_waist"],["hips_cm","w_hips"],["chest_cm","w_chest"],["arm_cm","w_arm"],["thigh_cm","w_thigh"]]) {
      if (last[k] != null) $(field).placeholder = "آخر مرّة: " + last[k];
    }
  }
}

function setAdhereUI(hit) {
  $("adhereYes").style.background = hit === true ? "var(--brand)" : "";
  $("adhereYes").style.color = hit === true ? "#04120a" : "";
  $("adhereNo").style.background = hit === false ? "var(--danger)" : "";
  $("adhereNo").style.color = hit === false ? "#fff" : "";
}

async function saveAdhere(hit) {
  setAdhereUI(hit);
  const { error } = await sb.from("adherence").upsert(
    { client_id: profile.id, date: todayISO(), hit_plan: hit, notes: $("adhereNote").value.trim() || null },
    { onConflict: "client_id,date" }
  );
  if (error) return toast(error.message, true);
  toast(hit ? "برافو — سجّلنا إنك تبعت ✅" : "تسجّل. غدوة نهار جديد 💪");
  loadProgress();
}
$("adhereYes").onclick = () => saveAdhere(true);
$("adhereNo").onclick = () => saveAdhere(false);

// ---------------- TODAY: weight ----------------
$("saveWeight").onclick = async () => {
  const num = (id) => { const v = $(id).value.trim(); return v === "" ? null : parseFloat(v); };
  const row = {
    client_id: profile.id, date: todayISO(),
    weight_kg: num("w_weight"), waist_cm: num("w_waist"), hips_cm: num("w_hips"),
    chest_cm: num("w_chest"), arm_cm: num("w_arm"), thigh_cm: num("w_thigh"),
  };
  if (Object.values(row).slice(2).every((v) => v == null)) return toast("دخّل رقم واحد عالأقل.", true);
  $("saveWeight").disabled = true;
  const { error } = await sb.from("weigh_ins").upsert(row, { onConflict: "client_id,date" });
  $("saveWeight").disabled = false;
  if (error) return toast(error.message, true);
  toast("تسجّل 📊");
  ["w_weight","w_waist","w_hips","w_chest","w_arm","w_thigh"].forEach((id) => ($(id).value = ""));
  loadToday(); loadProgress();
};

// ---------------- FOOD LOG ----------------
let mealPhotoFile = null;
$("m_photo").onchange = () => {
  mealPhotoFile = $("m_photo").files[0] || null;
  $("m_photoName").textContent = mealPhotoFile ? "📷 " + mealPhotoFile.name : "";
};

$("saveMeal").onclick = async () => {
  const desc = $("m_desc").value.trim();
  if (!desc) return toast("اكتب شنوّة كليت.", true);
  $("saveMeal").disabled = true;
  try {
    let photo_path = null;
    if (mealPhotoFile) {
      const ext = (mealPhotoFile.name.split(".").pop() || "jpg").toLowerCase();
      photo_path = `${profile.id}/meal-${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from("photos").upload(photo_path, mealPhotoFile);
      if (upErr) throw upErr;
    }
    const cal = $("m_cal").value.trim();
    const { error } = await sb.from("meals").insert({
      client_id: profile.id,
      meal_type: $("m_type").value,
      description: desc,
      calories: cal === "" ? null : parseInt(cal, 10),
      photo_path,
    });
    if (error) throw error;
    toast("الوجبة تزادت 🍽️");
    $("m_desc").value = ""; $("m_cal").value = ""; $("m_photo").value = "";
    mealPhotoFile = null; $("m_photoName").textContent = "";
    loadMeals();
  } catch (e) {
    toast(e.message || "ما نجّمناش نزيدو الوجبة.", true);
  } finally {
    $("saveMeal").disabled = false;
  }
};

async function loadMeals() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { data } = await sb.from("meals").select("*").eq("client_id", profile.id)
    .gte("eaten_at", start.toISOString()).order("eaten_at", { ascending: false });
  const list = $("mealList");
  list.innerHTML = "";
  $("noMeals").classList.toggle("hide", !!(data && data.length));
  let total = 0;
  for (const m of data || []) {
    if (m.calories) total += m.calories;
    let thumb = "";
    if (m.photo_path) {
      const { data: signed } = await sb.storage.from("photos").createSignedUrl(m.photo_path, 3600);
      if (signed?.signedUrl) thumb = `<img src="${signed.signedUrl}" style="width:52px;height:52px;object-fit:cover;border-radius:9px;flex:none">`;
    }
    const time = new Date(m.eaten_at).toLocaleTimeString("ar-TN", { hour: "2-digit", minute: "2-digit" });
    const el = document.createElement("div");
    el.style.cssText = "display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)";
    el.innerHTML = `${thumb}
      <div style="flex:1">
        <div style="font-weight:600"><span class="pill">${esc(MEAL_AR[m.meal_type] || "")}</span> ${esc(m.description)}</div>
        <div class="small muted">${time}${m.calories ? " · " + m.calories + " كالوري" : ""}</div>
      </div>`;
    list.appendChild(el);
  }
  $("m_totalCal").textContent = total + " كالوري";
}

// ---------------- PHOTOS ----------------
document.querySelectorAll(".photoInput").forEach((inp) => {
  inp.onchange = async () => {
    const file = inp.files[0];
    if (!file) return;
    const pose = inp.dataset.pose;
    $("photoMsg").textContent = "قاعد يطلّع " + (POSE_AR[pose] || pose) + "…";
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${profile.id}/${Date.now()}-${pose}.${ext}`;
      const { error: upErr } = await sb.storage.from("photos").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await sb.from("photos").insert({ client_id: profile.id, date: todayISO(), pose, storage_path: path });
      if (insErr) throw insErr;
      $("photoMsg").textContent = "";
      toast("التصويرة تطلّعت 📷");
      loadPhotos();
    } catch (e) {
      $("photoMsg").textContent = e.message || "ما نجّمناش نطلّعو التصويرة.";
    } finally {
      inp.value = "";
    }
  };
});

async function loadPhotos() {
  const { data } = await sb.from("photos").select("*").eq("client_id", profile.id).order("created_at", { ascending: false }).limit(9);
  const grid = $("photoGrid");
  grid.innerHTML = "";
  $("noPhotos").classList.toggle("hide", !!(data && data.length));
  if (!data) return;
  for (const p of data) {
    const { data: signed } = await sb.storage.from("photos").createSignedUrl(p.storage_path, 3600);
    const cell = document.createElement("div");
    cell.innerHTML = `<img src="${signed?.signedUrl || ""}" alt="${esc(p.pose)}"><div class="photo-tag">${esc(POSE_AR[p.pose] || p.pose)} · ${fmtDate(p.date)}</div>`;
    grid.appendChild(cell);
  }
}

// ---------------- CHECK-IN ----------------
["sleep","energy","hunger","mood"].forEach((k) => {
  const el = $("c_" + k);
  el.oninput = () => ($("v_" + k).textContent = el.value);
});

async function loadCheckin() {
  const { data } = await sb.from("checkins").select("*").eq("client_id", profile.id).eq("week_start", weekStartISO()).maybeSingle();
  if (data) {
    for (const k of ["sleep","energy","hunger","mood"]) {
      if (data[k] != null) { $("c_" + k).value = data[k]; $("v_" + k).textContent = data[k]; }
    }
    $("c_notes").value = data.notes || "";
  }
  const { data: fb } = await sb.from("checkins").select("coach_feedback,week_start").eq("client_id", profile.id)
    .not("coach_feedback", "is", null).order("week_start", { ascending: false }).limit(1).maybeSingle();
  if (fb && fb.coach_feedback) {
    $("feedbackCard").classList.remove("hide");
    $("coachFeedback").textContent = fb.coach_feedback;
  }
}

$("saveCheckin").onclick = async () => {
  $("saveCheckin").disabled = true;
  const row = {
    client_id: profile.id, week_start: weekStartISO(),
    sleep: +$("c_sleep").value, energy: +$("c_energy").value,
    hunger: +$("c_hunger").value, mood: +$("c_mood").value,
    notes: $("c_notes").value.trim() || null,
  };
  const { error } = await sb.from("checkins").upsert(row, { onConflict: "client_id,week_start" });
  $("saveCheckin").disabled = false;
  if (error) return toast(error.message, true);
  toast("المتابعة تبعثت 🙌");
};

// ---------------- PROGRESS ----------------
async function loadProgress() {
  const uid = profile.id;
  const { data: weights } = await sb.from("weigh_ins").select("date,weight_kg").eq("client_id", uid)
    .not("weight_kg", "is", null).order("date", { ascending: true });

  const bars = $("weightBars");
  bars.innerHTML = "";
  if (weights && weights.length) {
    $("noWeight").classList.add("hide");
    const vals = weights.map((w) => w.weight_kg);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const latest = vals[vals.length - 1];
    const first = vals[0];
    $("s_weight").textContent = latest + " كغ";
    const diff = (latest - first);
    $("s_change").textContent = (diff > 0 ? "+" : "") + diff.toFixed(1) + " كغ";
    $("s_change").style.color = diff <= 0 ? "var(--brand)" : "var(--amber)";
    for (const w of weights.slice(-12)) {
      const h = 15 + ((w.weight_kg - min) / span) * 80;
      const b = document.createElement("div");
      b.className = "b"; b.style.height = h + "%";
      b.innerHTML = `<span>${w.weight_kg}</span><em>${fmtDate(w.date)}</em>`;
      bars.appendChild(b);
    }
  } else {
    $("noWeight").classList.remove("hide");
    $("s_weight").textContent = "–"; $("s_change").textContent = "–";
  }

  const { data: adh } = await sb.from("adherence").select("date,hit_plan").eq("client_id", uid).order("date", { ascending: false }).limit(60);
  let streak = 0;
  if (adh) {
    for (const a of adh) { if (a.hit_plan) streak++; else break; }
    const last30 = adh.filter((a) => (new Date() - new Date(a.date)) / 86400000 <= 30);
    const hit = last30.filter((a) => a.hit_plan).length;
    $("s_compliance").textContent = last30.length ? Math.round((hit / last30.length) * 100) + "%" : "–";
  }
  $("s_streak").textContent = streak;
}

sb.auth.onAuthStateChange((_e, session) => { if (!session) boot(); });
boot();
