#!/usr/bin/env python3
"""
Creates/updates /mon-espace (website_id=11) — the authenticated "Espace personnel" of a
parent (Chantier A, session Claude n°2).

The page is a QWeb view rendered by Odoo's website: for a public visitor it shows a
login/sign-up card with the GDPR notice; for a logged-in portal user it boots a small
single-page JS app that talks to Odoo through /web/dataset/call_kw (the standard JSON-RPC
endpoint, session-authenticated) on the manual models created by build_espace_backend.py.
All access control happens server-side (ir.model.access + per-parent ir.rule): the JS
never decides who may see what.

Sub-modules (one child profile → several records):
  Croissance      dated height/weight, BMI computed in the browser (weight / height²),
                  displayed raw with links to official reference curves by country —
                  never an automated medical judgement.
  Scolarité       year, class, subject, grade/appreciation, comment.
  Vaccins         reminder list (name, date, planned booster) — no medical logic.
  Activités       sport / extracurricular.
  Bourses         scholarship applications, amounts typed by the user.
  Calendrier      several logical calendars (Enfant / Coparentalité / Perso), events
                  optionally shared with the co-parent.
  Dépenses        child expenses with "paid by", category, agreed split %, sharing.
  Assistant       rule-based "neutral language" helper (scripts/neutral_language.js),
                  no AI API call — decision by Julien.

Co-parent sharing: the account holder types the co-parent's e-mail on the child profile;
once that person logs in with the same e-mail, the record rules let them see the child
and whatever is flagged as shared. No e-mail notification is sent for now (Julien:
in-app only, e-mail = backlog).

Run:  python3 build_espace_backend.py  (once)  then  python3 update_mon_espace.py
Requires: ODOO_URL / ODOO_DB / ODOO_LOGIN / ODOO_API_KEY env vars.
"""
import html
import json
import os
import re
import xmlrpc.client
from lxml import etree

import build_pages as bp

ODOO_URL = os.environ.get("ODOO_URL", "https://pet-stone.shop")
ODOO_DB = os.environ.get("ODOO_DB", "dyonysos")
ODOO_LOGIN = os.environ.get("ODOO_LOGIN", "julien.daures@gmail.com")
ODOO_API_KEY = os.environ.get("ODOO_API_KEY")
WEBSITE_ID = 11
URL = "/mon-espace"
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Official growth-curve references by country (links only; the site never interprets
# a BMI value itself). Each entry: label, url, note. All five links checked 06/09/2026
# (WebSearch/WebFetch): the old cress-umr1153.fr/index.php/... path returns 404, the
# /fr/... one is the live page.
# ---------------------------------------------------------------------------
CURVES = {
    "fr": ("Courbes de croissance de référence du carnet de santé (CRESS / Inserm, 2018)", "https://cress-umr1153.fr/fr/courbes-de-croissance-de-reference-du-carnet-de-sante/", "Courbes officielles du carnet de santé français depuis avril 2018 (AFPA – CRESS/Inserm)."),
    "be": ("ONE — Croissance : comment comprendre les courbes (carnet de l'enfant)", "https://www.airdefamilles.be/croissancecomment-comprendre-les-courbes/", "Explication de l'Office de la Naissance et de l'Enfance (Fédération Wallonie-Bruxelles) sur les courbes du carnet de l'enfant."),
    "ch": ("Courbes de croissance — pédiatrie suisse", "https://www.paediatrieschweiz.ch/fr/documents/courbes-de-croissance/", "Documents de référence de la société pédiatrie suisse."),
    "qc": ("Courbes de croissance de l'OMS pour le Canada — Société canadienne de pédiatrie", "https://cps.ca/fr/tools-outils/courbes-de-croissance-de-loms", "Courbes de l'OMS adaptées pour le Canada (utilisées au Québec), publiées avec les Diététistes du Canada."),
    "who": ("Normes de croissance de l'OMS (0-5 ans) et références 5-19 ans", "https://www.who.int/tools/child-growth-standards", "Référence internationale, utile si votre pays n'est pas listé."),
}

NEUTRAL_JS = open(os.path.join(HERE, "neutral_language.js"), encoding="utf-8").read()
APP_JS = open(os.path.join(HERE, "mon_espace_app.js"), encoding="utf-8").read()

# ---------------------------------------------------------------------------
# CSS specific to the app (shared site CSS comes from build_pages.page_doc)
# ---------------------------------------------------------------------------
CSS = """
#ps-app { max-width: 1080px; margin: 0 auto; }
.ps-layout { display: grid; grid-template-columns: 260px 1fr; gap: 24px; }
@media (max-width: 800px) { .ps-layout { grid-template-columns: 1fr; } }
.ps-side .card { padding: 14px; margin-bottom: 10px; cursor: pointer; }
.ps-side .card.active { outline: 2px solid #C96A8C; }
.ps-main .card { padding: 18px; margin-bottom: 16px; }
.ps-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.ps-tabs button { border: 1px solid #e3d6e2; background: #fff; border-radius: 999px; padding: 6px 14px; font-size: 13.5px; cursor: pointer; color: #3a2f3b; }
.ps-tabs button.active { background: #C96A8C; color: #fff; border-color: #C96A8C; }
.ps-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.ps-table th, .ps-table td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #efe6ee; vertical-align: top; }
.ps-table th { color: #7a6d7c; font-weight: 600; font-size: 12.5px; }
.ps-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin: 10px 0; }
.ps-form label { display: flex; flex-direction: column; font-size: 12.5px; color: #5c5460; gap: 4px; }
.ps-form input, .ps-form select, .ps-form textarea { border: 1px solid #ddd0dc; border-radius: 8px; padding: 7px 9px; font-size: 14px; font-family: inherit; }
.ps-form textarea { min-height: 60px; }
.ps-form .wide { grid-column: 1 / -1; }
.ps-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.ps-btn { border: none; border-radius: 999px; padding: 8px 16px; font-size: 13.5px; cursor: pointer; background: #C96A8C; color: #fff; }
.ps-btn.secondary { background: #F3E9F4; color: #3a2f3b; }
.ps-btn.danger { background: #fff; color: #b3261e; border: 1px solid #f0c9c5; }
.ps-btn.small { padding: 4px 10px; font-size: 12.5px; }
.ps-badge { display: inline-block; background: #FBF3E4; color: #7a5a1a; border-radius: 999px; padding: 2px 9px; font-size: 11.5px; margin-left: 6px; }
.ps-badge.shared { background: #E4F3EA; color: #1f6b3a; }
.ps-badge.soon { background: #FDE8E6; color: #b3261e; }
.ps-note { font-size: 13px; color: #5c5460; background: #F3E9F4; padding: 10px 14px; border-radius: 10px; line-height: 1.6; }
.ps-msg { font-size: 13.5px; padding: 10px 14px; border-radius: 10px; margin-bottom: 12px; }
.ps-msg.err { background: #FDE8E6; color: #b3261e; }
.ps-msg.ok { background: #E4F3EA; color: #1f6b3a; }
.ps-kpi { display: flex; gap: 12px; flex-wrap: wrap; margin: 8px 0 14px; }
.ps-kpi div { background: #FBF3E4; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #5c5460; }
.ps-kpi strong { display: block; font-size: 18px; color: #3a2f3b; }
.ps-issue { border-left: 3px solid #C96A8C; padding: 6px 10px; margin: 6px 0; font-size: 13px; background: #fff; }
.ps-issue em { color: #b3261e; font-style: normal; }
.ps-empty { color: #8a7d8c; font-size: 13.5px; padding: 8px 0; }
"""

# ---------------------------------------------------------------------------
# QWeb body. JS/CSS are html-escaped into the arch: lxml un-escapes them at parse time
# and QWeb outputs static text verbatim, so `&&` / `<` survive the round trip.
# ---------------------------------------------------------------------------
INTRO = bp.hero(
    "Mon espace",
    "Vos enfants, votre organisation — au même endroit, visibles par vous seul·e et par le co-parent que vous choisissez.",
    wip=False,
)

PUBLIC_BLOCK = """
  <section>
    <div style="max-width:640px; margin:0 auto;">
      <div class="card" style="padding:24px; text-align:center;">
        <div class="headline" style="font-size:20px; color:#3a2f3b; margin-bottom:10px;">Connectez-vous pour accéder à votre espace</div>
        <p style="font-size:14.5px; line-height:1.7; color:#5c5460;">L'espace personnel permet de suivre la croissance, la scolarité, les vaccins, les activités et les bourses de chaque enfant, de tenir un calendrier et un carnet de dépenses partageables avec l'autre parent, et de préparer des messages coparentaux au ton neutre.</p>
        <p style="margin:16px 0;">
          <a href="/web/login?redirect=/mon-espace" class="btn btn-primary">Se connecter</a>
          <a href="/web/signup?redirect=/mon-espace" class="btn" style="margin-left:8px;">Créer un compte</a>
        </p>
        <p style="font-size:12.5px; line-height:1.6; color:#7a6d7c; text-align:left; background:#F3E9F4; padding:12px 14px; border-radius:10px;">
          <strong>Données personnelles (RGPD).</strong> Les informations que vous enregistrez sur vos enfants sont stockées sur ce site pour votre usage et celui du co-parent que vous invitez explicitement ; elles ne sont jamais publiques ni cédées. Vous en êtes responsable et pouvez les modifier ou les supprimer à tout moment depuis votre espace. Le site ne fournit aucune interprétation médicale ou juridique. Pour toute demande d'accès ou de suppression : voir <a href="/a-propos#contact">Contact</a>.
        </p>
      </div>
    </div>
  </section>
"""

APP_BLOCK = f"""
  <section>
    <style>{CSS}</style>
    <script id="ps-curves" type="application/json">{html.escape(json.dumps(CURVES, ensure_ascii=False), quote=False)}</script>
    <div id="ps-app" t-att-data-partner="request.env.user.partner_id.id" t-att-data-login="request.env.user.login" t-att-data-name="request.env.user.name">
      <div class="ps-empty">Chargement de votre espace…</div>
    </div>
    <div style="max-width:1080px; margin:16px auto 0; font-size:12px; color:#8a7d8c; text-align:right;">
      Connecté·e en tant que <t t-esc="request.env.user.name"/> · <a href="/web/session/logout?redirect=/mon-espace">Se déconnecter</a>
    </div>
    <script>{html.escape(NEUTRAL_JS, quote=False)}</script>
    <script>{html.escape(APP_JS, quote=False)}</script>
  </section>
"""

BODY = INTRO + f"""
  <t t-if="request.website.is_public_user()">{PUBLIC_BLOCK}</t>
  <t t-else="">{APP_BLOCK}</t>
"""


def build_arch(key):
    arch = bp.page_doc(
        "Mon espace",
        "Espace personnel du parent : profils enfants, croissance, scolarité, vaccins, activités, bourses, calendrier et dépenses partageables avec le co-parent.",
        BODY,
    ).replace("PLACEHOLDER_KEY", key)
    bad_amp = re.findall(r"&(?!amp;|#\d+;|lt;|gt;|quot;)", arch)
    if bad_amp:
        raise SystemExit(f"unescaped & found ({len(bad_amp)})")
    etree.fromstring(arch.encode("utf-8"))  # validate well-formed XML before sending
    return arch


def main():
    if not ODOO_API_KEY:
        raise SystemExit("Set ODOO_API_KEY env var")

    key = "website.parentsolo_mon_espace"
    arch = build_arch(key)

    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {})
    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")

    existing = models.execute_kw(
        ODOO_DB, uid, ODOO_API_KEY, "website.page", "search_read",
        [[["website_id", "=", WEBSITE_ID], ["url", "=", URL]]],
        {"fields": ["id", "view_id"]},
    )
    if existing:
        view_id = existing[0]["view_id"][0]
        models.execute_kw(ODOO_DB, uid, ODOO_API_KEY, "ir.ui.view", "write", [[view_id], {"arch_db": arch}])
        models.execute_kw(ODOO_DB, uid, ODOO_API_KEY, "website.page", "write", [[existing[0]["id"]], {"is_published": True}])
        print(f"updated: {URL} (page id {existing[0]['id']})")
        return

    view_id = models.execute_kw(ODOO_DB, uid, ODOO_API_KEY, "ir.ui.view", "create", [{
        "name": "Mon espace",
        "key": key,
        "type": "qweb",
        "arch_db": arch,
        "website_id": WEBSITE_ID,
    }])
    page_id = models.execute_kw(ODOO_DB, uid, ODOO_API_KEY, "website.page", "create", [{
        "url": URL,
        "website_id": WEBSITE_ID,
        "view_id": view_id,
        "is_published": True,
        "key": key,
    }])
    print(f"created: {URL} (page id {page_id})")


if __name__ == "__main__":
    main()
