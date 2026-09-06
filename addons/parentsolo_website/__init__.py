# -*- coding: utf-8 -*-
from . import controllers

import logging

_logger = logging.getLogger(__name__)

PARENTSOLO_WEBSITE_ID = 11  # "Parents Solo — Brouillon" (voir DELEGATION-AGENT-2.md)


def post_init_hook(env):
    """Ajoute l'entrée « Mon espace » au menu du site Parents Solo (idempotent).

    Odoo 19 passe `env` directement au hook. Le menu est rattaché au menu racine du
    site n°11 ; s'il existe déjà (ré-installation), rien n'est créé.
    """
    website = env["website"].browse(PARENTSOLO_WEBSITE_ID).exists()
    if not website:
        _logger.warning("parentsolo_website: website id %s introuvable, menu non créé", PARENTSOLO_WEBSITE_ID)
        return
    Menu = env["website.menu"]
    if Menu.search([("website_id", "=", website.id), ("url", "=", "/mon-espace")], limit=1):
        return
    root = website.menu_id
    vals = {
        "name": "Mon espace",
        "url": "/mon-espace",
        "website_id": website.id,
        "parent_id": root.id if root else False,
        "sequence": 90,
    }
    # Visible uniquement aux comptes connectés quand le champ existe (Odoo ≥ 17) ; sinon
    # le menu est visible à tous et la page elle-même affiche la carte de connexion.
    if "group_ids" in Menu._fields:
        portal = env.ref("base.group_portal", raise_if_not_found=False)
        internal = env.ref("base.group_user", raise_if_not_found=False)
        gids = [g.id for g in (portal, internal) if g]
        if gids:
            vals["group_ids"] = [(6, 0, gids)]
    Menu.create(vals)
    _logger.info("parentsolo_website: menu « Mon espace » créé sur le site %s", website.name)
