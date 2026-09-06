# -*- coding: utf-8 -*-
{
    "name": "Parents Solo — site (module réel)",
    "summary": "Pages QWeb natives (website.layout), espace personnel des parents, API publique lecture seule de la messagerie",
    "version": "19.0.1.0.0",
    "category": "Website",
    "author": "Julien Daures / DYONYSOS",
    "license": "LGPL-3",
    "website": "https://parentsolo.dyonysos.fr",
    "depends": ["website", "portal"],
    "data": [
        "views/templates.xml",
    ],
    "post_init_hook": "post_init_hook",
    "installable": True,
    "application": False,
    "description": """
Chantier D (session Claude n°2, 06/09/2026) — premier vrai addon du site Parents Solo.

Pourquoi : les 17 pages actuelles sont du HTML brut écrit dans ir.ui.view.arch par des
scripts XML-RPC ; elles n'appellent jamais website.layout, donc l'héritage de vues Odoo
(snippets, menus, widgets injectés) n'a aucun effet dessus. Et /web/dataset/call_kw refuse
tout appel anonyme, donc une messagerie lisible sans compte a besoin d'un vrai contrôleur
auth='public'.

Ce module fournit :
  * une page pilote /mon-espace rendue par un template QWeb versionné (views/templates.xml)
    qui fait t-call="website.layout" — l'espace personnel du chantier A, servi par un
    contrôleur (website=True) au lieu d'une website.page patchée ;
  * GET /parentsolo/api/general-messages : lecture seule, anonyme, strictement limitée aux
    canaux de type « général » de la messagerie (aucune écriture anonyme) ;
  * un hook d'installation qui ajoute l'entrée de menu « Mon espace » au site n°11.

Les modèles métier restent les modèles manuels x_parentsolo_* créés par
scripts/build_messaging_backend.py et scripts/build_espace_backend.py (ils fonctionnent ;
migration vers des classes Python = étape suivante, voir README.md).
""",
}
