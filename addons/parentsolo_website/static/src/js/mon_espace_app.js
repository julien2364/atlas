/*
 * Parents Solo — application JS de la page /mon-espace (Chantier A, session n°2).
 * Inlinée dans la vue QWeb par update_mon_espace.py. Aucune dépendance, aucun build.
 * Toute la sécurité est côté serveur (ir.model.access + ir.rule par parent) : ce code ne
 * fait qu'afficher ce que l'API accepte de renvoyer à l'utilisateur connecté.
 */
(function () {
  "use strict";
  const root = document.getElementById("ps-app");
  if (!root) return;
  const ME = { partner: parseInt(root.dataset.partner, 10), login: root.dataset.login || "", name: root.dataset.name || "" };
  const CURVES = JSON.parse(root.dataset.curves || "{}");

  // ---------- RPC ----------
  async function rpc(model, method, args, kwargs) {
    const res = await fetch("/web/dataset/call_kw/" + model + "/" + method, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: Date.now(), params: { model: model, method: method, args: args || [], kwargs: kwargs || {} } }),
    });
    const data = await res.json();
    if (data.error) {
      const d = data.error.data || {};
      throw new Error(d.message || data.error.message || "Erreur serveur");
    }
    return data.result;
  }
  const searchRead = (model, domain, fields, order) => rpc(model, "search_read", [domain], { fields: fields, order: order || "id desc", limit: 500 });
  const create = (model, vals) => rpc(model, "create", [[vals]]);
  const write = (model, id, vals) => rpc(model, "write", [[id], vals]);
  const unlink = (model, id) => rpc(model, "unlink", [[id]]);

  // ---------- helpers ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
  const fmtDT = (s) => { if (!s) return ""; const d = new Date(s.replace(" ", "T") + "Z"); return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }); };
  const toOdooDT = (local) => { if (!local) return false; const d = new Date(local); return d.toISOString().slice(0, 19).replace("T", " "); };
  const fromOdooDT = (s) => { if (!s) return ""; const d = new Date(s.replace(" ", "T") + "Z"); const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); };
  const today = () => new Date().toISOString().slice(0, 10);
  const money = (n, cur) => (Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (cur || "EUR");
  function age(birth) {
    if (!birth) return "";
    const b = new Date(birth), n = new Date();
    let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
    if (n.getDate() < b.getDate()) months--;
    if (months < 0) return "";
    const y = Math.floor(months / 12), m = months % 12;
    return y < 2 ? months + " mois" : y + " ans" + (m ? " " + m + " mois" : "");
  }
  function daysUntil(d) { if (!d) return null; return Math.round((new Date(d) - new Date(today())) / 86400000); }

  // ---------- state ----------
  const S = { children: [], childId: null, tab: "enfants", childTab: "croissance", msg: null, editing: null, records: [], events: [], expenses: [] };

  // ---------- sub-module specs (child-scoped) ----------
  const SPECS = {
    croissance: {
      model: "x_parentsolo_growth_record", title: "Croissance", order: "x_date desc, id desc",
      fields: [
        { name: "x_date", label: "Date", type: "date", req: true, def: today },
        { name: "x_height_cm", label: "Taille (cm)", type: "number", step: "0.1" },
        { name: "x_weight_kg", label: "Poids (kg)", type: "number", step: "0.01" },
        { name: "x_head_cm", label: "Périmètre crânien (cm)", type: "number", step: "0.1" },
        { name: "x_note", label: "Remarque", type: "text" },
      ],
      nameFrom: (v) => "Mesure du " + fmtDate(v.x_date),
    },
    scolarite: {
      model: "x_parentsolo_school_record", title: "Scolarité", order: "x_date desc, id desc",
      fields: [
        { name: "x_school_year", label: "Année scolaire", type: "text", ph: "2026-2027" },
        { name: "x_class_level", label: "Classe / niveau", type: "text" },
        { name: "x_school_name", label: "Établissement", type: "text" },
        { name: "x_subject", label: "Matière", type: "text" },
        { name: "x_grade", label: "Note / appréciation", type: "text" },
        { name: "x_date", label: "Date", type: "date" },
        { name: "x_comment", label: "Commentaire", type: "textarea", wide: true },
      ],
      nameFrom: (v) => [v.x_school_year, v.x_class_level, v.x_subject].filter(Boolean).join(" · ") || "Suivi scolaire",
    },
    vaccins: {
      model: "x_parentsolo_vaccination", title: "Vaccins (pense-bête)", order: "x_next_date asc, x_date desc",
      fields: [
        { name: "x_name", label: "Vaccin", type: "text", req: true },
        { name: "x_date", label: "Fait le", type: "date" },
        { name: "x_next_date", label: "Rappel prévu le", type: "date" },
        { name: "x_done", label: "Rappel fait", type: "bool" },
        { name: "x_note", label: "Remarque", type: "text" },
      ],
      note: "Simple pense-bête : les dates sont celles que vous saisissez. Le calendrier vaccinal officiel de votre pays et votre médecin restent la référence.",
    },
    activites: {
      model: "x_parentsolo_activity", title: "Activités", order: "x_active_flag desc, id desc",
      fields: [
        { name: "x_name", label: "Activité", type: "text", req: true },
        { name: "x_kind", label: "Type", type: "select", opt: [["sport", "Sport"], ["art", "Art / musique"], ["lang", "Langue"], ["science", "Sciences / numérique"], ["other", "Autre"]] },
        { name: "x_frequency", label: "Fréquence", type: "text", ph: "mercredi 14h" },
        { name: "x_place", label: "Lieu", type: "text" },
        { name: "x_contact", label: "Contact", type: "text" },
        { name: "x_cost", label: "Coût (saisi par vous)", type: "number", step: "0.01" },
        { name: "x_active_flag", label: "En cours", type: "bool", def: () => true },
      ],
    },
    bourses: {
      model: "x_parentsolo_scholarship", title: "Bourses", order: "x_deadline asc, id desc",
      fields: [
        { name: "x_name", label: "Bourse", type: "text", req: true },
        { name: "x_organism", label: "Organisme", type: "text" },
        { name: "x_status", label: "Statut", type: "select", opt: [["todo", "À demander"], ["pending", "Demande en cours"], ["accepted", "Acceptée"], ["refused", "Refusée"]], def: () => "todo" },
        { name: "x_amount", label: "Montant (saisi par vous)", type: "number", step: "0.01" },
        { name: "x_deadline", label: "Date limite", type: "date" },
        { name: "x_note", label: "Notes", type: "textarea", wide: true },
      ],
      note: "Les montants et conditions des bourses changent chaque année : vérifiez-les auprès de l'organisme. Voir aussi la page Simulateurs pour les aides par pays.",
    },
  };

  // ---------- generic form/table rendering ----------
  function setMsg(kind, text) { S.msg = { kind: kind, text: text }; render(); if (kind === "ok") setTimeout(() => { S.msg = null; render(); }, 3500); }

  function fieldInput(f, v) {
    const val = v == null || v === false ? "" : v;
    const cls = f.wide ? ' class="wide"' : "";
    if (f.type === "select") return `<label${cls}>${esc(f.label)}<select name="${f.name}">${f.opt.map((o) => `<option value="${esc(o[0])}"${String(val) === String(o[0]) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select></label>`;
    if (f.type === "textarea") return `<label${cls}>${esc(f.label)}<textarea name="${f.name}">${esc(val)}</textarea></label>`;
    if (f.type === "bool") return `<label${cls} style="flex-direction:row;align-items:center;gap:8px;padding-top:18px"><input type="checkbox" name="${f.name}"${val ? " checked" : ""}/> ${esc(f.label)}</label>`;
    const type = f.type === "datetime" ? "datetime-local" : f.type;
    return `<label${cls}>${esc(f.label)}${f.req ? " *" : ""}<input type="${type}" name="${f.name}" value="${esc(val)}"${f.step ? ` step="${f.step}"` : ""}${f.ph ? ` placeholder="${esc(f.ph)}"` : ""}${f.req ? " required" : ""}/></label>`;
  }
  function readForm(form, fields) {
    const vals = {};
    fields.forEach((f) => {
      const el = form.querySelector(`[name="${f.name}"]`);
      if (!el) return;
      if (f.type === "bool") vals[f.name] = el.checked;
      else if (f.type === "number") vals[f.name] = el.value === "" ? 0 : parseFloat(el.value);
      else if (f.type === "datetime") vals[f.name] = toOdooDT(el.value);
      else vals[f.name] = el.value === "" ? false : el.value;
    });
    return vals;
  }
  function display(f, v) {
    if (v === false || v == null || v === "") return "";
    if (f.type === "date") return fmtDate(v);
    if (f.type === "datetime") return fmtDT(v);
    if (f.type === "bool") return v ? "oui" : "non";
    if (f.type === "select") { const o = (f.opt || []).find((x) => String(x[0]) === String(v)); return o ? o[1] : v; }
    if (f.type === "number") return Number(v).toLocaleString("fr-FR");
    return v;
  }
  const isMineChild = (c) => (c.x_parent_ids || []).indexOf(ME.partner) !== -1;

  // ---------- main render ----------
  function render() {
    const child = S.children.find((c) => c.id === S.childId);
    let side = `<div class="headline" style="font-size:15px;margin-bottom:8px">Mes enfants</div>`;
    side += S.children.map((c) => `<div class="card${c.id === S.childId && S.tab === "enfants" ? " active" : ""}" data-child="${c.id}"><strong>${esc(c.x_name)}</strong><div style="font-size:12.5px;color:#7a6d7c">${esc(age(c.x_birth_date))}${c.x_coparent_email ? '<span class="ps-badge shared">partagé</span>' : ""}${!isMineChild(c) ? '<span class="ps-badge">co-parent</span>' : ""}</div></div>`).join("");
    if (!S.children.length) side += `<div class="ps-empty">Aucun profil enfant pour l'instant.</div>`;
    side += `<button class="ps-btn secondary" data-act="new-child" style="width:100%;margin-top:6px">+ Ajouter un enfant</button>`;
    side += `<div style="margin-top:18px"><div class="headline" style="font-size:15px;margin-bottom:8px">Outils</div>
      <div class="card${S.tab === "calendrier" ? " active" : ""}" data-tab="calendrier">📅 Calendrier</div>
      <div class="card${S.tab === "depenses" ? " active" : ""}" data-tab="depenses">💶 Dépenses enfant</div>
      <div class="card${S.tab === "assistant" ? " active" : ""}" data-tab="assistant">✉️ Assistant langage neutre</div></div>`;

    let main = S.msg ? `<div class="ps-msg ${S.msg.kind}">${esc(S.msg.text)}</div>` : "";
    if (S.tab === "new-child") main += childForm(null);
    else if (S.tab === "edit-child" && child) main += childForm(child);
    else if (S.tab === "calendrier") main += calendarView();
    else if (S.tab === "depenses") main += expensesView();
    else if (S.tab === "assistant") main += assistantView();
    else if (child) main += childView(child);
    else main += welcomeView();

    root.innerHTML = `<div class="ps-layout"><aside class="ps-side">${side}</aside><section class="ps-main">${main}</section></div>`;
    bind();
  }

  function welcomeView() {
    return `<div class="card"><div class="headline" style="font-size:20px">Bonjour ${esc(ME.name)}</div>
      <p style="font-size:14px;line-height:1.7;color:#5c5460">Cet espace vous permet de garder au même endroit ce qui concerne vos enfants : croissance, scolarité, vaccins, activités, bourses, calendrier et dépenses — et de partager ce que vous choisissez avec l'autre parent.</p>
      <p class="ps-note">Vos données ne sont visibles que par vous et par le co-parent que vous invitez explicitement (par son adresse e-mail). Rien n'est public. Vous restez responsable des informations que vous enregistrez sur vos enfants ; vous pouvez tout supprimer à tout moment. Aucune interprétation médicale ou juridique n'est faite par le site.</p>
      ${S.children.length ? '<p style="font-size:14px">Sélectionnez un enfant à gauche pour commencer.</p>' : '<button class="ps-btn" data-act="new-child">Créer le premier profil enfant</button>'}</div>`;
  }

  function childForm(c) {
    const v = c || {};
    const sexOpts = [["f", "Fille"], ["m", "Garçon"], ["na", "Ne souhaite pas préciser"]];
    const countryOpts = [["fr", "France"], ["be", "Belgique"], ["ch", "Suisse"], ["qc", "Québec"]];
    return `<div class="card"><div class="headline" style="font-size:18px">${c ? "Modifier le profil" : "Nouveau profil enfant"}</div>
      <form class="ps-form" id="child-form">
        <label>Prénom *<input name="x_name" required value="${esc(v.x_name || "")}"/></label>
        <label>Date de naissance *<input type="date" name="x_birth_date" required value="${esc(v.x_birth_date || "")}"/></label>
        <label>Sexe (optionnel)<select name="x_sex"><option value="">—</option>${sexOpts.map((o) => `<option value="${o[0]}"${v.x_sex === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
        <label>Pays de référence<select name="x_country"><option value="">—</option>${countryOpts.map((o) => `<option value="${o[0]}"${v.x_country === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
        <label class="wide">E-mail du co-parent (partage, optionnel)<input type="email" name="x_coparent_email" value="${esc(v.x_coparent_email || "")}" placeholder="prenom@exemple.fr"/></label>
        <label class="wide">Notes<textarea name="x_notes">${esc(v.x_notes || "")}</textarea></label>
      </form>
      <p class="ps-note">Partage : la personne qui se connecte au site avec cette adresse e-mail verra ce profil, et les événements / dépenses que vous marquez « partagé ». Aucun e-mail n'est envoyé automatiquement pour l'instant : prévenez-la vous-même.</p>
      <div class="ps-actions"><button class="ps-btn" data-act="save-child"${c ? ` data-id="${c.id}"` : ""}>Enregistrer</button><button class="ps-btn secondary" data-act="cancel">Annuler</button>${c ? `<button class="ps-btn danger" data-act="del-child" data-id="${c.id}">Supprimer ce profil et toutes ses données</button>` : ""}</div></div>`;
  }

  function childView(c) {
    const tabs = [["croissance", "Croissance"], ["scolarite", "Scolarité"], ["vaccins", "Vaccins"], ["activites", "Activités"], ["bourses", "Bourses"]];
    let h = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div><div class="headline" style="font-size:20px">${esc(c.x_name)}</div><div style="font-size:13px;color:#7a6d7c">${esc(age(c.x_birth_date))} · né·e le ${fmtDate(c.x_birth_date)}${c.x_coparent_email ? " · partagé avec " + esc(c.x_coparent_email) : ""}</div></div><button class="ps-btn secondary small" data-act="edit-child">Modifier le profil</button></div></div>`;
    h += `<div class="ps-tabs">${tabs.map((t) => `<button class="${S.childTab === t[0] ? "active" : ""}" data-ctab="${t[0]}">${t[1]}</button>`).join("")}</div>`;
    const spec = SPECS[S.childTab];
    const rows = S.records || [];
    h += `<div class="card"><div class="headline" style="font-size:16px">${spec.title}</div>`;
    if (spec.note) h += `<p class="ps-note">${esc(spec.note)}</p>`;
    if (S.childTab === "croissance") h += growthExtras(c, rows);
    if (S.childTab === "vaccins") h += vaccineExtras(rows);
    h += recordForm(spec);
    h += recordTable(spec, rows);
    h += `</div>`;
    return h;
  }

  function recordForm(spec) {
    const e = S.editing || {};
    const isEdit = !!e.id;
    return `<details${isEdit ? " open" : ""} id="rec-details"><summary style="cursor:pointer;font-size:13.5px;color:#C96A8C">${isEdit ? "Modifier l'enregistrement" : "+ Ajouter"}</summary>
      <form class="ps-form" id="rec-form">${spec.fields.map((f) => fieldInput(f, e[f.name] != null ? e[f.name] : (f.def ? f.def() : ""))).join("")}</form>
      <div class="ps-actions"><button class="ps-btn" data-act="save-rec"${isEdit ? ` data-id="${e.id}"` : ""}>Enregistrer</button>${isEdit ? `<button class="ps-btn secondary" data-act="cancel-rec">Annuler</button>` : ""}</div></details>`;
  }
  function recordTable(spec, rows) {
    if (!rows.length) return `<div class="ps-empty">Rien pour l'instant.</div>`;
    const cols = spec.fields.filter((f) => f.type !== "textarea");
    const isGrowth = S.childTab === "croissance";
    return `<div style="overflow-x:auto"><table class="ps-table"><thead><tr>${cols.map((f) => `<th>${esc(f.label)}</th>`).join("")}${isGrowth ? "<th>IMC</th>" : ""}<th></th></tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((f) => `<td>${esc(display(f, r[f.name]))}</td>`).join("")}${isGrowth ? `<td>${bmi(r)}</td>` : ""}<td style="white-space:nowrap"><button class="ps-btn secondary small" data-act="edit-rec" data-id="${r.id}">✎</button> <button class="ps-btn danger small" data-act="del-rec" data-id="${r.id}">✕</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  // BMI = weight / height² — raw value only, no interpretation (children's BMI is read on
  // age/sex reference curves by a professional).
  function bmi(r) {
    if (!r.x_height_cm || !r.x_weight_kg) return "";
    const h = r.x_height_cm / 100;
    return (r.x_weight_kg / (h * h)).toFixed(1);
  }
  function growthExtras(c, rows) {
    const key = c.x_country && CURVES[c.x_country] ? c.x_country : "who";
    const cur = CURVES[key];
    const last = rows.find((r) => r.x_height_cm && r.x_weight_kg);
    let h = `<div class="ps-kpi">`;
    if (rows[0] && rows[0].x_height_cm) h += `<div>Dernière taille<strong>${rows[0].x_height_cm} cm</strong>${fmtDate(rows[0].x_date)}</div>`;
    if (rows[0] && rows[0].x_weight_kg) h += `<div>Dernier poids<strong>${rows[0].x_weight_kg} kg</strong>${fmtDate(rows[0].x_date)}</div>`;
    if (last) h += `<div>IMC (poids ÷ taille²)<strong>${bmi(last)}</strong>valeur brute, sans interprétation</div>`;
    h += `</div>`;
    h += `<p class="ps-note">L'IMC affiché est un simple calcul poids ÷ taille². Chez l'enfant, il ne se lit qu'en le reportant sur une courbe de référence selon l'âge et le sexe : <a href="${esc(cur[1])}" target="_blank" rel="noopener">${esc(cur[0])}</a> — ${esc(cur[2])} Le site ne porte aucun jugement médical ; parlez-en à votre médecin ou à votre service de santé infantile.</p>`;
    return h;
  }
  function vaccineExtras(rows) {
    const soon = rows.filter((r) => !r.x_done && r.x_next_date && daysUntil(r.x_next_date) <= 60);
    if (!soon.length) return "";
    return `<p class="ps-note">Rappels à venir (dans les 60 jours) ou dépassés : ${soon.map((r) => `<span class="ps-badge${daysUntil(r.x_next_date) < 0 ? " soon" : ""}">${esc(r.x_name)} — ${fmtDate(r.x_next_date)}</span>`).join(" ")}</p>`;
  }

  // ---------- calendar ----------
  const CAL_NAMES = [["enfant", "Enfant"], ["coparentalite", "Coparentalité"], ["perso", "Perso"]];
  const CAL_FIELDS = [
    { name: "x_name", label: "Titre", type: "text", req: true },
    { name: "x_calendar_name", label: "Calendrier", type: "select", opt: CAL_NAMES, def: () => "enfant" },
    { name: "x_child_id", label: "Enfant concerné", type: "select", opt: [] },
    { name: "x_start", label: "Début", type: "datetime", req: true },
    { name: "x_end", label: "Fin", type: "datetime" },
    { name: "x_all_day", label: "Journée entière", type: "bool" },
    { name: "x_place", label: "Lieu", type: "text" },
    { name: "x_shared_with_coparent", label: "Partager avec le co-parent", type: "bool" },
    { name: "x_description", label: "Description", type: "textarea", wide: true },
  ];
  function childOpts() { return [["", "—"]].concat(S.children.map((c) => [String(c.id), c.x_name])); }
  function calendarView() {
    const filt = S.calFilter || "all";
    const rows = (S.events || []).filter((e) => filt === "all" || e.x_calendar_name === filt);
    const e = S.editing || {};
    CAL_FIELDS[2].opt = childOpts();
    const vals = Object.assign({}, e, { x_child_id: e.x_child_id ? String(e.x_child_id[0]) : "", x_start: fromOdooDT(e.x_start), x_end: fromOdooDT(e.x_end) });
    let h = `<div class="card"><div class="headline" style="font-size:18px">Calendrier</div>
      <p class="ps-note">Trois calendriers logiques : « Enfant » (école, santé, activités), « Coparentalité » (alternance, passages de relais, rendez-vous à deux) et « Perso ». Cochez « partager » pour qu'un événement soit visible par le co-parent rattaché à l'enfant concerné. Pas d'export ni de notification pour l'instant (backlog).</p>
      <div class="ps-tabs">${[["all", "Tous"]].concat(CAL_NAMES).map((t) => `<button class="${filt === t[0] ? "active" : ""}" data-calf="${t[0]}">${t[1]}</button>`).join("")}</div>
      <details${e.id ? " open" : ""}><summary style="cursor:pointer;font-size:13.5px;color:#C96A8C">${e.id ? "Modifier l'événement" : "+ Ajouter un événement"}</summary>
      <form class="ps-form" id="cal-form">${CAL_FIELDS.map((f) => fieldInput(f, vals[f.name] != null && vals[f.name] !== "" ? vals[f.name] : (f.def ? f.def() : ""))).join("")}</form>
      <div class="ps-actions"><button class="ps-btn" data-act="save-cal"${e.id ? ` data-id="${e.id}"` : ""}>Enregistrer</button>${e.id ? `<button class="ps-btn secondary" data-act="cancel-rec">Annuler</button>` : ""}</div></details>`;
    if (!rows.length) h += `<div class="ps-empty">Aucun événement.</div>`;
    else {
      let month = "";
      h += `<table class="ps-table"><tbody>`;
      rows.forEach((ev) => {
        const m = ev.x_start ? new Date(ev.x_start.replace(" ", "T") + "Z").toLocaleString("fr-FR", { month: "long", year: "numeric" }) : "";
        if (m !== month) { month = m; h += `<tr><th colspan="3" style="background:#FBF3E4;text-transform:capitalize">${esc(m)}</th></tr>`; }
        const mine = ev.x_owner_partner_id && ev.x_owner_partner_id[0] === ME.partner;
        h += `<tr><td style="white-space:nowrap">${ev.x_all_day ? fmtDate(ev.x_start) : fmtDT(ev.x_start)}${ev.x_end && !ev.x_all_day ? " → " + fmtDT(ev.x_end) : ""}</td>
          <td><strong>${esc(ev.x_name)}</strong><span class="ps-badge">${esc(display(CAL_FIELDS[1], ev.x_calendar_name))}</span>${ev.x_child_id ? `<span class="ps-badge">${esc(ev.x_child_id[1])}</span>` : ""}${ev.x_shared_with_coparent ? '<span class="ps-badge shared">partagé</span>' : ""}${!mine ? '<span class="ps-badge">par le co-parent</span>' : ""}${ev.x_place ? `<div style="font-size:12.5px;color:#7a6d7c">${esc(ev.x_place)}</div>` : ""}${ev.x_description ? `<div style="font-size:12.5px;color:#5c5460">${esc(ev.x_description)}</div>` : ""}</td>
          <td style="white-space:nowrap">${mine ? `<button class="ps-btn secondary small" data-act="edit-cal" data-id="${ev.id}">✎</button> <button class="ps-btn danger small" data-act="del-cal" data-id="${ev.id}">✕</button>` : ""}</td></tr>`;
      });
      h += `</tbody></table>`;
    }
    return h + `</div>`;
  }

  // ---------- expenses ----------
  const EXP_FIELDS = [
    { name: "x_name", label: "Libellé", type: "text", req: true },
    { name: "x_child_id", label: "Enfant", type: "select", opt: [], req: true },
    { name: "x_amount", label: "Montant", type: "number", step: "0.01", req: true },
    { name: "x_currency", label: "Devise", type: "select", opt: [["EUR", "EUR"], ["CHF", "CHF"], ["CAD", "CAD"]], def: () => "EUR" },
    { name: "x_date", label: "Date", type: "date", req: true, def: today },
    { name: "x_paid_by", label: "Payé par", type: "select", opt: [["me", "Moi"], ["coparent", "Le co-parent"], ["other", "Autre"]], def: () => "me" },
    { name: "x_category", label: "Catégorie", type: "select", opt: [["sante", "Santé"], ["scolarite", "Scolarité"], ["activites", "Activités"], ["vetements", "Vêtements"], ["garde", "Garde"], ["transport", "Transport"], ["autre", "Autre"]], def: () => "autre" },
    { name: "x_split_pct", label: "Part à ma charge (%)", type: "number", step: "1", def: () => 50 },
    { name: "x_shared_with_coparent", label: "Partager avec le co-parent", type: "bool" },
    { name: "x_note", label: "Remarque", type: "text" },
  ];
  function expensesView() {
    const rows = S.expenses || [];
    const e = S.editing || {};
    EXP_FIELDS[1].opt = childOpts().slice(1);
    const vals = Object.assign({}, e, { x_child_id: e.x_child_id ? String(e.x_child_id[0]) : (S.children[0] ? String(S.children[0].id) : "") });
    // Totals per currency; "my share" uses the split % typed by the user (never a legal computation).
    const byCur = {};
    rows.forEach((r) => {
      const c = r.x_currency || "EUR";
      const t = byCur[c] = byCur[c] || { total: 0, me: 0, cop: 0, myShare: 0 };
      const pct = r.x_split_pct === false || r.x_split_pct == null ? 50 : r.x_split_pct;
      // From the viewer's point of view: what the owner typed as "me" is "the co-parent" for the other parent.
      const mine = r.x_owner_partner_id && r.x_owner_partner_id[0] === ME.partner;
      const paidByMe = mine ? r.x_paid_by === "me" : r.x_paid_by === "coparent";
      const paidByCop = mine ? r.x_paid_by === "coparent" : r.x_paid_by === "me";
      t.total += r.x_amount;
      if (paidByMe) t.me += r.x_amount;
      if (paidByCop) t.cop += r.x_amount;
      t.myShare += r.x_amount * ((mine ? pct : 100 - pct) / 100);
    });
    let h = `<div class="card"><div class="headline" style="font-size:18px">Dépenses enfant</div>
      <p class="ps-note">Un carnet de dépenses partagé, pas un outil juridique : la « part à ma charge » est la répartition que vous avez convenue entre vous (ou fixée par une décision), saisie par vous. Le site ne calcule aucune contribution alimentaire — voir la page Simulateurs pour les méthodes par pays.</p>
      <div class="ps-kpi">${Object.keys(byCur).map((c) => `<div>Total ${c}<strong>${money(byCur[c].total, c)}</strong>payé par moi ${money(byCur[c].me, c)} · par le co-parent ${money(byCur[c].cop, c)}<br/>ma part convenue ${money(byCur[c].myShare, c)} → ${byCur[c].me - byCur[c].myShare >= 0 ? "j'ai avancé" : "il me reste à couvrir"} ${money(Math.abs(byCur[c].me - byCur[c].myShare), c)}</div>`).join("") || "<div>Aucune dépense</div>"}</div>
      <details${e.id ? " open" : ""}><summary style="cursor:pointer;font-size:13.5px;color:#C96A8C">${e.id ? "Modifier la dépense" : "+ Ajouter une dépense"}</summary>
      <form class="ps-form" id="exp-form">${EXP_FIELDS.map((f) => fieldInput(f, vals[f.name] != null && vals[f.name] !== "" ? vals[f.name] : (f.def ? f.def() : ""))).join("")}</form>
      <div class="ps-actions"><button class="ps-btn" data-act="save-exp"${e.id ? ` data-id="${e.id}"` : ""}>Enregistrer</button>${e.id ? `<button class="ps-btn secondary" data-act="cancel-rec">Annuler</button>` : ""}</div></details>`;
    if (!S.children.length) h += `<div class="ps-empty">Créez d'abord un profil enfant.</div>`;
    else if (!rows.length) h += `<div class="ps-empty">Aucune dépense.</div>`;
    else h += `<div style="overflow-x:auto"><table class="ps-table"><thead><tr><th>Date</th><th>Libellé</th><th>Enfant</th><th>Catégorie</th><th>Payé par</th><th>Montant</th><th>Part</th><th></th></tr></thead><tbody>${rows.map((r) => {
      const mine = r.x_owner_partner_id && r.x_owner_partner_id[0] === ME.partner;
      return `<tr><td>${fmtDate(r.x_date)}</td><td>${esc(r.x_name)}${r.x_shared_with_coparent ? '<span class="ps-badge shared">partagé</span>' : ""}${!mine ? '<span class="ps-badge">saisi par le co-parent</span>' : ""}${r.x_note ? `<div style="font-size:12px;color:#7a6d7c">${esc(r.x_note)}</div>` : ""}</td><td>${esc(r.x_child_id ? r.x_child_id[1] : "")}</td><td>${esc(display(EXP_FIELDS[6], r.x_category))}</td><td>${esc(display(EXP_FIELDS[5], r.x_paid_by))}${!mine ? " (de son point de vue)" : ""}</td><td>${money(r.x_amount, r.x_currency)}</td><td>${r.x_split_pct === false || r.x_split_pct == null ? "" : r.x_split_pct + " %"}</td><td style="white-space:nowrap">${mine ? `<button class="ps-btn secondary small" data-act="edit-exp" data-id="${r.id}">✎</button> <button class="ps-btn danger small" data-act="del-exp" data-id="${r.id}">✕</button>` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>`;
    return h + `</div>`;
  }

  // ---------- neutral-language assistant ----------
  function assistantView() {
    const r = S.assist || null;
    let h = `<div class="card"><div class="headline" style="font-size:18px">Assistant « langage neutre »</div>
      <p class="ps-note">Avant d'envoyer un message à l'autre parent, collez-le ici : l'assistant repère les tournures qui font monter le conflit (généralisations, accusations, jugements, menaces, enfant pris à témoin…) et propose une reformulation factuelle. Tout se passe dans votre navigateur : rien n'est enregistré ni transmis, et aucune intelligence artificielle externe n'est utilisée — ce sont des règles de langage simples. La reformulation est un brouillon à relire, pas un texte à envoyer tel quel.</p>
      <textarea id="assist-in" style="width:100%;min-height:120px;border:1px solid #ddd0dc;border-radius:10px;padding:10px;font-family:inherit;font-size:14px">${esc(S.assistText || "")}</textarea>
      <div class="ps-actions"><button class="ps-btn" data-act="assist">Analyser</button><button class="ps-btn secondary" data-act="assist-template">Partir du modèle fait → conséquence → demande</button></div>`;
    if (r) {
      if (r.neutral) h += `<div class="ps-msg ok" style="margin-top:12px">Aucune tournure conflictuelle détectée par les règles. Relisez tout de même : l'assistant ne comprend pas le sens, seulement des formes.</div>`;
      else {
        h += `<div style="margin-top:12px;font-size:13.5px"><strong>${r.issues.length} point${r.issues.length > 1 ? "s" : ""} à revoir</strong> (indice de tension : ${r.score}/100)</div>`;
        h += r.issues.map((i) => `<div class="ps-issue"><em>« ${esc(i.match.trim())} »</em> — ${esc(i.label)}<div style="color:#5c5460">${esc(i.why)}</div>${i.suggestion ? `<div>→ <strong>${esc(i.suggestion)}</strong></div>` : "<div>→ à retirer</div>"}</div>`).join("");
        h += `<div style="margin-top:10px;font-size:13px;color:#7a6d7c">Proposition de reformulation (à compléter aux endroits entre parenthèses) :</div>
          <textarea id="assist-out" style="width:100%;min-height:100px;border:1px solid #cfe3d6;background:#f4faf6;border-radius:10px;padding:10px;font-family:inherit;font-size:14px">${esc(r.rewrite)}</textarea>
          <div class="ps-actions"><button class="ps-btn secondary" data-act="assist-copy">Copier la reformulation</button></div>`;
      }
    }
    return h + `</div>`;
  }

  // ---------- data loading ----------
  async function loadChildren() {
    S.children = await searchRead("x_parentsolo_child", [], ["x_name", "x_birth_date", "x_sex", "x_country", "x_coparent_email", "x_notes", "x_parent_ids"], "x_birth_date asc");
    if (S.childId && !S.children.find((c) => c.id === S.childId)) S.childId = null;
  }
  async function loadRecords() {
    if (!S.childId) { S.records = []; return; }
    const spec = SPECS[S.childTab];
    S.records = await searchRead(spec.model, [["x_child_id", "=", S.childId]], ["x_name"].concat(spec.fields.map((f) => f.name)), spec.order);
  }
  async function loadEvents() { S.events = await searchRead("x_parentsolo_calendar_event", [], ["x_name", "x_calendar_name", "x_child_id", "x_start", "x_end", "x_all_day", "x_place", "x_shared_with_coparent", "x_description", "x_owner_partner_id"], "x_start asc"); }
  async function loadExpenses() { S.expenses = await searchRead("x_parentsolo_child_expense", [], ["x_name", "x_child_id", "x_amount", "x_currency", "x_date", "x_paid_by", "x_category", "x_split_pct", "x_shared_with_coparent", "x_note", "x_owner_partner_id"], "x_date desc"); }

  async function go(fn) { try { await fn(); render(); } catch (e) { setMsg("err", e.message); } }

  // ---------- events ----------
  function bind() {
    root.querySelectorAll("[data-child]").forEach((el) => { el.onclick = () => go(async () => { S.childId = parseInt(el.dataset.child, 10); S.tab = "enfants"; S.editing = null; await loadRecords(); }); });
    root.querySelectorAll("[data-tab]").forEach((el) => { el.onclick = () => go(async () => { S.tab = el.dataset.tab; S.editing = null; if (S.tab === "calendrier") await loadEvents(); if (S.tab === "depenses") await loadExpenses(); }); });
    root.querySelectorAll("[data-ctab]").forEach((el) => { el.onclick = () => go(async () => { S.childTab = el.dataset.ctab; S.editing = null; await loadRecords(); }); });
    root.querySelectorAll("[data-calf]").forEach((el) => { el.onclick = () => { S.calFilter = el.dataset.calf; render(); }; });
    root.querySelectorAll("[data-act]").forEach((el) => { el.onclick = (ev) => { ev.preventDefault(); action(el.dataset.act, el); }; });
  }

  function action(act, el) {
    const id = el.dataset.id ? parseInt(el.dataset.id, 10) : null;
    switch (act) {
      case "new-child": S.tab = "new-child"; S.editing = null; render(); break;
      case "edit-child": S.tab = "edit-child"; render(); break;
      case "cancel": S.tab = "enfants"; render(); break;
      case "cancel-rec": S.editing = null; render(); break;
      case "save-child": go(async () => {
        const f = document.getElementById("child-form");
        if (!f.reportValidity()) return;
        const vals = { x_name: f.x_name.value.trim(), x_birth_date: f.x_birth_date.value, x_sex: f.x_sex.value || false, x_country: f.x_country.value || false, x_coparent_email: f.x_coparent_email.value.trim().toLowerCase() || false, x_notes: f.x_notes.value || false };
        if (vals.x_coparent_email && vals.x_coparent_email === ME.login.toLowerCase()) throw new Error("L'adresse du co-parent ne peut pas être la vôtre.");
        if (id) { await write("x_parentsolo_child", id, vals); }
        else { vals.x_parent_ids = [[6, 0, [ME.partner]]]; const nid = await create("x_parentsolo_child", vals); S.childId = Array.isArray(nid) ? nid[0] : nid; }
        await loadChildren(); S.tab = "enfants"; S.childTab = "croissance"; await loadRecords(); setMsg("ok", "Profil enregistré.");
      }); break;
      case "del-child": if (confirm("Supprimer définitivement ce profil et toutes ses données (croissance, scolarité, vaccins, activités, bourses, dépenses) ?")) go(async () => { await unlink("x_parentsolo_child", id); S.childId = null; S.tab = "enfants"; await loadChildren(); setMsg("ok", "Profil supprimé."); }); break;
      case "save-rec": go(async () => {
        const spec = SPECS[S.childTab]; const f = document.getElementById("rec-form");
        if (!f.reportValidity()) return;
        const vals = readForm(f, spec.fields); vals.x_child_id = S.childId;
        if (!vals.x_name && spec.nameFrom) vals.x_name = spec.nameFrom(vals);
        if (!vals.x_name) vals.x_name = spec.title;
        if (id) await write(spec.model, id, vals); else await create(spec.model, vals);
        S.editing = null; await loadRecords(); setMsg("ok", "Enregistré.");
      }); break;
      case "edit-rec": S.editing = S.records.find((r) => r.id === id); render(); { const d = document.getElementById("rec-details"); if (d) d.scrollIntoView({ behavior: "smooth" }); } break;
      case "del-rec": if (confirm("Supprimer cet enregistrement ?")) go(async () => { await unlink(SPECS[S.childTab].model, id); await loadRecords(); }); break;
      case "save-cal": go(async () => {
        const f = document.getElementById("cal-form"); if (!f.reportValidity()) return;
        const vals = readForm(f, CAL_FIELDS); vals.x_child_id = vals.x_child_id ? parseInt(vals.x_child_id, 10) : false;
        if (vals.x_shared_with_coparent && !vals.x_child_id) throw new Error("Pour partager un événement, choisissez l'enfant concerné (le partage passe par le co-parent rattaché à l'enfant).");
        if (id) await write("x_parentsolo_calendar_event", id, vals); else { vals.x_owner_partner_id = ME.partner; await create("x_parentsolo_calendar_event", vals); }
        S.editing = null; await loadEvents(); setMsg("ok", "Événement enregistré.");
      }); break;
      case "edit-cal": S.editing = S.events.find((r) => r.id === id); render(); break;
      case "del-cal": if (confirm("Supprimer cet événement ?")) go(async () => { await unlink("x_parentsolo_calendar_event", id); await loadEvents(); }); break;
      case "save-exp": go(async () => {
        const f = document.getElementById("exp-form"); if (!f.reportValidity()) return;
        const vals = readForm(f, EXP_FIELDS); vals.x_child_id = parseInt(vals.x_child_id, 10); vals.x_split_pct = Math.max(0, Math.min(100, Math.round(vals.x_split_pct || 0)));
        if (id) await write("x_parentsolo_child_expense", id, vals); else { vals.x_owner_partner_id = ME.partner; await create("x_parentsolo_child_expense", vals); }
        S.editing = null; await loadExpenses(); setMsg("ok", "Dépense enregistrée.");
      }); break;
      case "edit-exp": S.editing = S.expenses.find((r) => r.id === id); render(); break;
      case "del-exp": if (confirm("Supprimer cette dépense ?")) go(async () => { await unlink("x_parentsolo_child_expense", id); await loadExpenses(); }); break;
      case "assist": S.assistText = document.getElementById("assist-in").value; S.assist = window.ParentSoloNeutral.analyze(S.assistText); render(); break;
      case "assist-template": S.assistText = window.ParentSoloNeutral.TEMPLATE; S.assist = null; render(); break;
      case "assist-copy": { const t = document.getElementById("assist-out"); t.select(); if (navigator.clipboard) { navigator.clipboard.writeText(t.value).then(() => setMsg("ok", "Reformulation copiée.")); } else { document.execCommand("copy"); } break; }
    }
  }

  go(async () => { await loadChildren(); });
})();
