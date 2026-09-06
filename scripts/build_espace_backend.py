#!/usr/bin/env python3
"""
Creates/updates the BACKEND of the "Espace personnel" (Chantier A, session Claude n°2):
manual Odoo models (x_parentsolo_*), portal access rights and — the real novelty of this
chantier — record rules scoped to the parent(s) attached to each child, so that a portal
user can never read/write data about a child that is not theirs.

Same pattern as build_messaging_backend.py (manual models created through ir.model /
ir.model.fields via XML-RPC), but the ir.rule domains are per-parent instead of
per-portal-group.

Data model (all fields user-entered; nothing is computed server-side, no medical logic):

  x_parentsolo_child           child profile: x_name (first name), birth date, optional sex,
                               parents (m2m res.partner), optional co-parent e-mail.
  x_parentsolo_growth_record   dated height/weight (+ optional head circumference). BMI is
                               computed client-side only (see update_mon_espace.py).
  x_parentsolo_school_record   school year, class, subject, grade/appreciation, comment.
  x_parentsolo_vaccination     vaccine name, date given, planned booster (reminder only).
  x_parentsolo_activity        sport / extracurricular activity.
  x_parentsolo_scholarship     scholarship application (amount typed by the user only).
  x_parentsolo_calendar_event  event, logical calendar name, optional sharing with co-parent.
  x_parentsolo_child_expense   child expense, "paid by", category, same co-parent sharing.

Security model:
  * A record "belongs" to the parents of its child (x_child_id.x_parent_ids) — a child
    belongs to the partners listed in x_parent_ids.
  * Co-parent sharing works by e-mail (x_coparent_email): the other parent, once logged in
    with that e-mail as login, sees the shared child/events/expenses. This avoids giving
    portal users any search access on res.partner. A m2o x_coparent_partner_id is kept
    for a later server-side resolution (backlog).
  * Calendar events and expenses have an owner (x_owner_partner_id, forced to the current
    user's partner by the page's JS and verified by the rule on create) and are visible to
    the co-parent only when x_shared_with_coparent is True.
  * Portal group gets read/write/create/unlink on all 8 models, restricted by the rules.
    Internal users (admin) are not restricted by these rules (portal group only).

Idempotent: re-running updates existing models/fields/ACLs/rules in place.

Run:  export ODOO_API_KEY="..." ; python3 build_espace_backend.py
Requires: ODOO_URL / ODOO_DB / ODOO_LOGIN / ODOO_API_KEY env vars (key never on disk).
"""
import os
import xmlrpc.client

ODOO_URL = os.environ.get("ODOO_URL", "https://pet-stone.shop")
ODOO_DB = os.environ.get("ODOO_DB", "dyonysos")
ODOO_LOGIN = os.environ.get("ODOO_LOGIN", "julien.daures@gmail.com")
ODOO_API_KEY = os.environ.get("ODOO_API_KEY")

# ---------------------------------------------------------------------------
# Model definitions
# ---------------------------------------------------------------------------
# Each field: (name, ttype, label, extra) — extra may contain relation, required,
# selection (list of (value, label)), help, default, on_delete.

CHILD = "x_parentsolo_child"

# Rule fragments. `user` is the current res.users record in the ir.rule eval context.
PARENT_OF_CHILD = "('x_child_id.x_parent_ids', 'in', [user.partner_id.id])"
COPARENT_OF_CHILD = "('x_child_id.x_coparent_email', '=', user.login)"
CHILD_SCOPE = f"['|', {PARENT_OF_CHILD}, {COPARENT_OF_CHILD}]"

# Owner-or-shared scope for calendar events and expenses:
#   owner == me  OR  (shared AND child set AND I am a parent/co-parent of that child)
SHARED_SCOPE = (
    "['|', ('x_owner_partner_id', '=', user.partner_id.id), "
    "'&', '&', ('x_shared_with_coparent', '=', True), "
    "('x_child_id', '!=', False), "
    f"'|', {PARENT_OF_CHILD}, {COPARENT_OF_CHILD}]"
)

MODELS = [
    {
        "model": CHILD,
        "name": "Parents Solo — Profil enfant",
        "fields": [
            ("x_birth_date", "date", "Date de naissance", {"required": True}),
            ("x_sex", "selection", "Sexe (optionnel)", {"selection": [("f", "Fille"), ("m", "Garçon"), ("na", "Ne souhaite pas préciser")]}),
            ("x_parent_ids", "many2many", "Parent(s) rattaché(s)", {"relation": "res.partner", "relation_table": "x_parentsolo_child_res_partner_rel", "column1": "child_id", "column2": "partner_id"}),
            ("x_coparent_email", "char", "E-mail du co-parent (partage)", {"help": "Le co-parent voit ce profil (et ce que vous partagez) une fois connecté avec cette adresse."}),
            ("x_coparent_partner_id", "many2one", "Co-parent (contact)", {"relation": "res.partner"}),
            ("x_country", "selection", "Pays de référence", {"selection": [("fr", "France"), ("be", "Belgique"), ("ch", "Suisse"), ("qc", "Québec")]}),
            ("x_notes", "text", "Notes", {}),
        ],
        # A child is visible to its parents, or to the co-parent invited by e-mail.
        "rule": "['|', ('x_parent_ids', 'in', [user.partner_id.id]), ('x_coparent_email', '=', user.login)]",
    },
    {
        "model": "x_parentsolo_growth_record",
        "name": "Parents Solo — Mesure croissance",
        "fields": [
            ("x_child_id", "many2one", "Enfant", {"relation": CHILD, "required": True, "on_delete": "cascade"}),
            ("x_date", "date", "Date de la mesure", {"required": True}),
            ("x_height_cm", "float", "Taille (cm)", {}),
            ("x_weight_kg", "float", "Poids (kg)", {}),
            ("x_head_cm", "float", "Périmètre crânien (cm)", {}),
            ("x_note", "char", "Remarque", {}),
        ],
        "rule": CHILD_SCOPE,
    },
    {
        "model": "x_parentsolo_school_record",
        "name": "Parents Solo — Suivi scolaire",
        "fields": [
            ("x_child_id", "many2one", "Enfant", {"relation": CHILD, "required": True, "on_delete": "cascade"}),
            ("x_school_year", "char", "Année scolaire", {"help": "Ex. 2026-2027"}),
            ("x_class_level", "char", "Classe / niveau", {}),
            ("x_school_name", "char", "Établissement", {}),
            ("x_subject", "char", "Matière", {}),
            ("x_grade", "char", "Note / appréciation", {}),
            ("x_date", "date", "Date", {}),
            ("x_comment", "text", "Commentaire", {}),
        ],
        "rule": CHILD_SCOPE,
    },
    {
        "model": "x_parentsolo_vaccination",
        "name": "Parents Solo — Vaccination (pense-bête)",
        "fields": [
            ("x_child_id", "many2one", "Enfant", {"relation": CHILD, "required": True, "on_delete": "cascade"}),
            ("x_date", "date", "Date d'administration", {}),
            ("x_next_date", "date", "Rappel prévu le", {}),
            ("x_done", "boolean", "Fait", {}),
            ("x_note", "char", "Remarque", {}),
        ],
        "rule": CHILD_SCOPE,
    },
    {
        "model": "x_parentsolo_activity",
        "name": "Parents Solo — Activité extrascolaire",
        "fields": [
            ("x_child_id", "many2one", "Enfant", {"relation": CHILD, "required": True, "on_delete": "cascade"}),
            ("x_kind", "selection", "Type", {"selection": [("sport", "Sport"), ("art", "Art / musique"), ("lang", "Langue"), ("science", "Sciences / numérique"), ("other", "Autre")]}),
            ("x_frequency", "char", "Fréquence", {"help": "Ex. mercredi 14h, 2x/semaine"}),
            ("x_place", "char", "Lieu", {}),
            ("x_contact", "char", "Contact (optionnel)", {}),
            ("x_cost", "float", "Coût (saisi par vous)", {}),
            ("x_active_flag", "boolean", "En cours", {}),
        ],
        "rule": CHILD_SCOPE,
    },
    {
        "model": "x_parentsolo_scholarship",
        "name": "Parents Solo — Bourse d'étude",
        "fields": [
            ("x_child_id", "many2one", "Enfant", {"relation": CHILD, "required": True, "on_delete": "cascade"}),
            ("x_organism", "char", "Organisme", {}),
            ("x_status", "selection", "Statut", {"selection": [("todo", "À demander"), ("pending", "Demande en cours"), ("accepted", "Acceptée"), ("refused", "Refusée")]}),
            ("x_amount", "float", "Montant (saisi par vous)", {}),
            ("x_deadline", "date", "Date limite", {}),
            ("x_note", "text", "Notes", {}),
        ],
        "rule": CHILD_SCOPE,
    },
    {
        "model": "x_parentsolo_calendar_event",
        "name": "Parents Solo — Événement calendrier",
        "fields": [
            ("x_owner_partner_id", "many2one", "Créé par", {"relation": "res.partner", "required": True}),
            ("x_child_id", "many2one", "Enfant concerné", {"relation": CHILD, "on_delete": "set null"}),
            ("x_calendar_name", "selection", "Calendrier", {"selection": [("enfant", "Enfant"), ("coparentalite", "Coparentalité"), ("perso", "Perso")], "required": True}),
            ("x_start", "datetime", "Début", {"required": True}),
            ("x_end", "datetime", "Fin", {}),
            ("x_all_day", "boolean", "Journée entière", {}),
            ("x_place", "char", "Lieu", {}),
            ("x_shared_with_coparent", "boolean", "Partagé avec le co-parent", {}),
            ("x_coparent_partner_id", "many2one", "Co-parent (contact)", {"relation": "res.partner"}),
            ("x_description", "text", "Description", {}),
        ],
        "rule": SHARED_SCOPE,
    },
    {
        "model": "x_parentsolo_child_expense",
        "name": "Parents Solo — Dépense enfant",
        "fields": [
            ("x_owner_partner_id", "many2one", "Créé par", {"relation": "res.partner", "required": True}),
            ("x_child_id", "many2one", "Enfant", {"relation": CHILD, "required": True, "on_delete": "cascade"}),
            ("x_amount", "float", "Montant", {"required": True}),
            ("x_currency", "selection", "Devise", {"selection": [("EUR", "EUR"), ("CHF", "CHF"), ("CAD", "CAD")]}),
            ("x_date", "date", "Date", {"required": True}),
            ("x_paid_by", "selection", "Payé par", {"selection": [("me", "Moi"), ("coparent", "Le co-parent"), ("other", "Autre")]}),
            ("x_category", "selection", "Catégorie", {"selection": [("sante", "Santé"), ("scolarite", "Scolarité"), ("activites", "Activités"), ("vetements", "Vêtements"), ("garde", "Garde"), ("transport", "Transport"), ("autre", "Autre")]}),
            ("x_shared_with_coparent", "boolean", "Partagé avec le co-parent", {}),
            ("x_coparent_partner_id", "many2one", "Co-parent (contact)", {"relation": "res.partner"}),
            ("x_split_pct", "integer", "Part à ma charge (%)", {"help": "Répartition convenue, saisie par vous — aucun calcul légal n'est fait par le site."}),
            ("x_note", "char", "Remarque", {}),
        ],
        "rule": SHARED_SCOPE,
    },
]


# ---------------------------------------------------------------------------
# XML-RPC helpers
# ---------------------------------------------------------------------------
class Odoo:
    def __init__(self):
        if not ODOO_API_KEY:
            raise SystemExit("Set ODOO_API_KEY env var")
        common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
        self.uid = common.authenticate(ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {})
        if not self.uid:
            raise SystemExit("Authentication failed")
        self.models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")

    def call(self, model, method, *args, **kw):
        return self.models.execute_kw(ODOO_DB, self.uid, ODOO_API_KEY, model, method, list(args), kw)

    def search_read(self, model, domain, fields, **kw):
        return self.call(model, "search_read", domain, fields=fields, **kw)

    def ref(self, xmlid):
        module, name = xmlid.split(".")
        rec = self.search_read("ir.model.data", [["module", "=", module], ["name", "=", name]], ["res_id"], limit=1)
        if not rec:
            raise SystemExit(f"xmlid not found: {xmlid}")
        return rec[0]["res_id"]


def ensure_model(o, spec):
    existing = o.search_read("ir.model", [["model", "=", spec["model"]]], ["id"], limit=1)
    if existing:
        mid = existing[0]["id"]
        o.call("ir.model", "write", [mid], {"name": spec["name"]})
        print(f"  model ok      {spec['model']} (id {mid})")
    else:
        mid = o.call("ir.model", "create", {"name": spec["name"], "model": spec["model"], "state": "manual"})
        print(f"  model created {spec['model']} (id {mid})")
    return mid


def ensure_field(o, model_id, model_name, fname, ttype, label, extra):
    vals = {
        "name": fname,
        "field_description": label,
        "ttype": ttype,
        "model_id": model_id,
        "state": "manual",
        "required": bool(extra.get("required")),
        "help": extra.get("help", False),
    }
    if ttype in ("many2one", "many2many", "one2many"):
        vals["relation"] = extra["relation"]
    if ttype == "many2one" and extra.get("on_delete"):
        vals["on_delete"] = extra["on_delete"]
    if ttype == "many2many":
        vals["relation_table"] = extra["relation_table"]
        vals["column1"] = extra["column1"]
        vals["column2"] = extra["column2"]
    existing = o.search_read("ir.model.fields", [["model_id", "=", model_id], ["name", "=", fname]], ["id", "ttype"], limit=1)
    if existing:
        fid = existing[0]["id"]
        if existing[0]["ttype"] != ttype:
            print(f"    !! {model_name}.{fname}: type {existing[0]['ttype']} != {ttype} — left unchanged")
            return fid
        upd = {"field_description": label, "required": vals["required"], "help": vals["help"]}
        if ttype == "selection":
            cur = o.search_read("ir.model.fields.selection", [["field_id", "=", fid]], ["id", "value", "name"])
            cur_by_val = {c["value"]: c for c in cur}
            cmds = []
            for i, (v, lbl) in enumerate(extra["selection"]):
                if v in cur_by_val:
                    cmds.append((1, cur_by_val[v]["id"], {"name": lbl, "sequence": i}))
                else:
                    cmds.append((0, 0, {"value": v, "name": lbl, "sequence": i}))
            upd["selection_ids"] = cmds
        o.call("ir.model.fields", "write", [fid], upd)
        return fid
    if ttype == "selection":
        vals["selection_ids"] = [(0, 0, {"value": v, "name": lbl, "sequence": i}) for i, (v, lbl) in enumerate(extra["selection"])]
    fid = o.call("ir.model.fields", "create", vals)
    print(f"    + field {model_name}.{fname} ({ttype})")
    return fid


def ensure_access(o, model_id, model_name, group_id):
    name = f"{model_name}_portal"
    vals = {"name": name, "model_id": model_id, "group_id": group_id,
            "perm_read": True, "perm_write": True, "perm_create": True, "perm_unlink": True}
    existing = o.search_read("ir.model.access", [["model_id", "=", model_id], ["group_id", "=", group_id]], ["id"], limit=1)
    if existing:
        o.call("ir.model.access", "write", [existing[0]["id"]], vals)
    else:
        o.call("ir.model.access", "create", vals)
        print(f"    + access {name}")


def ensure_rule(o, model_id, model_name, group_id, domain):
    name = f"{model_name}: parents rattachés uniquement"
    vals = {"name": name, "model_id": model_id, "domain_force": domain, "groups": [(6, 0, [group_id])],
            "perm_read": True, "perm_write": True, "perm_create": True, "perm_unlink": True, "active": True}
    existing = o.search_read("ir.rule", [["model_id", "=", model_id], ["groups", "in", [group_id]]], ["id"])
    if existing:
        o.call("ir.rule", "write", [existing[0]["id"]], vals)
        for extra in existing[1:]:
            o.call("ir.rule", "unlink", [extra["id"]])
        print(f"    rule updated  {model_name}")
    else:
        o.call("ir.rule", "create", vals)
        print(f"    + rule        {model_name}")


def main():
    o = Odoo()
    portal_gid = o.ref("base.group_portal")
    print(f"portal group id = {portal_gid}")

    model_ids = {}
    for spec in MODELS:
        print(spec["model"])
        mid = ensure_model(o, spec)
        model_ids[spec["model"]] = mid
        for fname, ttype, label, extra in spec["fields"]:
            ensure_field(o, mid, spec["model"], fname, ttype, label, extra)
        ensure_access(o, mid, spec["model"], portal_gid)
        ensure_rule(o, mid, spec["model"], portal_gid, spec["rule"])

    # ir.rule validates domain_force on create/write, so reaching this point means every
    # domain parsed server-side.
    print("\nDone. Models:", ", ".join(f"{m}={i}" for m, i in model_ids.items()))
    print("Next: python3 update_mon_espace.py  (page /mon-espace)")


if __name__ == "__main__":
    main()
