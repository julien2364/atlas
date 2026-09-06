# -*- coding: utf-8 -*-
"""
Contrôleurs du module parentsolo_website (Chantier D, session Claude n°2).

1. /mon-espace — page pilote rendue par un vrai template QWeb (views/templates.xml) qui
   appelle website.layout : header/footer/menus/snippets natifs Odoo s'appliquent.
   auth='public' + website=True : un visiteur anonyme voit la carte de connexion, un compte
   (portail ou interne) voit l'application. Les données passent ensuite par
   /web/dataset/call_kw (session authentifiée), protégées par les ir.rule par parent.

2. /parentsolo/api/general-messages — lecture ANONYME, seule et unique exception : les
   messages des canaux de type « général » de la messagerie communautaire. Pourquoi un
   contrôleur dédié : /web/dataset/call_kw refuse l'utilisateur public au niveau d'ir_http
   (_auth_method_user), quels que soient les droits configurés. Ici on lit en sudo() avec un
   domaine fixé côté serveur, une liste blanche de champs et une limite dure — aucune
   écriture, aucun paramètre libre injecté dans le domaine.

Les noms de modèles/champs de la messagerie viennent de build_messaging_backend.py
(session principale). Ils sont centralisés dans MESSAGING ci-dessous et vérifiés au premier
appel : si un nom ne correspond pas, l'endpoint renvoie une erreur 503 explicite au lieu de
données fausses — à ajuster une seule fois après lecture de build_messaging_backend.py.
"""
import json
import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

PARENTSOLO_WEBSITE_ID = 11

# --- Messagerie : noms à confirmer contre scripts/build_messaging_backend.py ---------------
MESSAGING = {
    "channel_model": "x_parentsolo_channel",
    "channel_type_field": "x_type",          # champ selection du canal
    "channel_type_general": "general",       # valeur « canal général »
    "channel_country_field": "x_country",    # optionnel : mis à None si le canal n'a pas de pays
    "channel_name_field": "x_name",
    "message_model": "x_parentsolo_message",
    "message_channel_field": "x_channel_id", # m2o vers le canal
    "message_body_field": "x_body",
    "message_author_field": "x_author_name", # char, ou m2o res.partner (display_name utilisé)
    "message_date_field": "create_date",
    "message_hidden_field": "x_hidden",      # optionnel : booléen « masqué par la modération »
}
MAX_MESSAGES = 50


def _check_messaging_config(env):
    """Retourne (ok, détail). Vérifie que modèles et champs existent réellement."""
    cfg = MESSAGING
    missing = []
    for mkey, fkeys in (
        ("channel_model", ["channel_type_field", "channel_name_field", "channel_country_field"]),
        ("message_model", ["message_channel_field", "message_body_field", "message_author_field", "message_date_field", "message_hidden_field"]),
    ):
        model = cfg[mkey]
        if model not in env:
            missing.append(f"modèle {model}")
            continue
        fields = env[model]._fields
        for fk in fkeys:
            fname = cfg.get(fk)
            if fname and fname not in fields:
                # les champs marqués optionnels ne bloquent pas
                if fk in ("channel_country_field", "message_hidden_field"):
                    continue
                missing.append(f"{model}.{fname}")
    return (not missing, ", ".join(missing))


class ParentsoloWebsite(http.Controller):

    # ------------------------------------------------------------------ page pilote
    @http.route(["/mon-espace"], type="http", auth="public", website=True, sitemap=False)
    def mon_espace(self, **kw):
        user = request.env.user
        is_public = user._is_public()
        values = {
            "is_public": is_public,
            "partner_id": user.partner_id.id if not is_public else 0,
            "login": user.login if not is_public else "",
            "user_name": user.name if not is_public else "",
            "curves_json": json.dumps(GROWTH_CURVES, ensure_ascii=False),
        }
        return request.render("parentsolo_website.mon_espace", values)

    # ------------------------------------------------------- API publique lecture seule
    @http.route(["/parentsolo/api/general-messages"], type="http", auth="public", methods=["GET"], csrf=False, website=True, sitemap=False)
    def general_messages(self, country=None, limit=None, **kw):
        env = request.env
        ok, detail = _check_messaging_config(env)
        if not ok:
            _logger.warning("parentsolo_website: config messagerie invalide : %s", detail)
            return self._json({"error": "messaging_config", "detail": detail}, status=503)
        cfg = MESSAGING
        Channel = env[cfg["channel_model"]].sudo()
        Message = env[cfg["message_model"]].sudo()

        # Domaine fixé côté serveur : uniquement les canaux généraux. Le pays est le seul
        # paramètre utilisateur, et il n'est accepté que parmi une liste fermée.
        domain = [(cfg["channel_type_field"], "=", cfg["channel_type_general"])]
        cf = cfg.get("channel_country_field")
        if country and cf and cf in Channel._fields:
            if country not in ("fr", "be", "ch", "qc", "ca"):
                return self._json({"error": "bad_country"}, status=400)
            domain.append((cf, "=", country))
        channel = Channel.search(domain, limit=1, order="id asc")
        if not channel:
            return self._json({"channel": None, "messages": []})

        try:
            lim = max(1, min(int(limit or MAX_MESSAGES), MAX_MESSAGES))
        except ValueError:
            lim = MAX_MESSAGES
        mdomain = [(cfg["message_channel_field"], "=", channel.id)]
        hf = cfg.get("message_hidden_field")
        if hf and hf in Message._fields:
            mdomain.append((hf, "=", False))
        msgs = Message.search(mdomain, limit=lim, order="id desc")

        af, bf, df = cfg["message_author_field"], cfg["message_body_field"], cfg["message_date_field"]
        out = []
        for m in msgs:
            author = m[af]
            if hasattr(author, "display_name"):
                author = author.display_name if author else ""
            date = m[df]
            out.append({
                "id": m.id,
                "author": author or "Anonyme",
                "body": m[bf] or "",
                "date": date.strftime("%Y-%m-%d %H:%M:%S") if date else "",
            })
        out.reverse()  # ordre chronologique
        return self._json({
            "channel": {"id": channel.id, "name": channel[cfg["channel_name_field"]]},
            "messages": out,
            "read_only": True,
        })

    @staticmethod
    def _json(payload, status=200):
        return request.make_response(
            json.dumps(payload, ensure_ascii=False),
            headers=[("Content-Type", "application/json; charset=utf-8"), ("Cache-Control", "no-store")],
            status=status,
        )


# Liens vers les courbes de croissance officielles (identiques à scripts/update_mon_espace.py,
# vérifiés le 06/09/2026). Le site n'interprète jamais un IMC.
GROWTH_CURVES = {
    "fr": ["Courbes de croissance de référence du carnet de santé (CRESS / Inserm, 2018)", "https://cress-umr1153.fr/fr/courbes-de-croissance-de-reference-du-carnet-de-sante/", "Courbes officielles du carnet de santé français depuis avril 2018 (AFPA – CRESS/Inserm)."],
    "be": ["ONE — Croissance : comment comprendre les courbes (carnet de l'enfant)", "https://www.airdefamilles.be/croissancecomment-comprendre-les-courbes/", "Explication de l'Office de la Naissance et de l'Enfance (Fédération Wallonie-Bruxelles) sur les courbes du carnet de l'enfant."],
    "ch": ["Courbes de croissance — pédiatrie suisse", "https://www.paediatrieschweiz.ch/fr/documents/courbes-de-croissance/", "Documents de référence de la société pédiatrie suisse."],
    "qc": ["Courbes de croissance de l'OMS pour le Canada — Société canadienne de pédiatrie", "https://cps.ca/fr/tools-outils/courbes-de-croissance-de-loms", "Courbes de l'OMS adaptées pour le Canada (utilisées au Québec), publiées avec les Diététistes du Canada."],
    "who": ["Normes de croissance de l'OMS (0-5 ans) et références 5-19 ans", "https://www.who.int/tools/child-growth-standards", "Référence internationale, utile si votre pays n'est pas listé."],
}
