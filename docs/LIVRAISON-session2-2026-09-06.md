# Livraison session Claude n°2 — 06/09/2026 (chantiers A prêt, D pilote, B recherche)

_À intégrer dans le dépôt principal par la session principale (ou par Julien) : copier les dossiers `addons/`, `scripts/` (4 nouveaux fichiers) et `docs/` à la racine du projet, puis commit._

## Fichiers livrés

- `scripts/build_espace_backend.py` — chantier A backend : 8 modèles manuels `x_parentsolo_*`, ACL portail, ir.rule scopées au(x) parent(s) + co-parent par e-mail (`user.login`). Idempotent.
- `scripts/update_mon_espace.py` + `scripts/mon_espace_app.js` + `scripts/neutral_language.js` — chantier A page `/mon-espace` (version « website.page », comme les 17 autres pages). À garder tant que le module D n'est pas installé.
- `addons/parentsolo_website/` — chantier D pilote : vrai module Odoo, `/mon-espace` en template QWeb avec `website.layout`, API publique `GET /parentsolo/api/general-messages`, menu « Mon espace ». Voir son `README.md` (vérifications + déploiement + tests).
- `docs/recherche-developpement-8-12-ans-2026-09-05.md` — chantier B : recherche sourcée 8-12 ans (aussi dans le projet Claude « releve claude 5-09 »).

## Ce qui n'a PAS pu être fait depuis la session cloud

- Aucune exécution XML-RPC ni déploiement : la politique réseau de la session cloud bloque `pet-stone.shop` (403 CONNECT) et SSH. Ordre d'exécution à faire depuis le Mac / la session principale :
  1. `export ODOO_API_KEY=...` ; `cd scripts && python3 build_espace_backend.py`
  2. `python3 update_mon_espace.py` (page version website.page) — ou directement installer le module D (le contrôleur a priorité sur la page).
  3. Tests sécurité à deux comptes portail (voir README du module, §Tests).
- `deploy_all.py` : ajouter `"update_mon_espace.py"` à `SCRIPTS` ; `build_pages.py` : ajouter `("Mon espace", "/mon-espace")` à `NAV` si le menu doit y figurer (sinon le module D crée l'entrée `website.menu`).
- Les signatures `bp.hero(title, subtitle, wip=False)` et `bp.page_doc(title, desc, body)` ont été déduites des scripts `update_axes_*.py` extraits du bundle ; à vérifier au premier lancement.

## Bloc à ajouter dans COMMENT-LANCER.md

### Fichiers du projet (ajouts)
- scripts/build_espace_backend.py — nouveau : backend de l'espace personnel (modèles x_parentsolo_child / growth_record / school_record / vaccination / activity / scholarship / calendar_event / child_expense, ACL portail, règles par parent). Hors deploy_all.py, à lancer une fois.
- scripts/update_mon_espace.py (+ mon_espace_app.js, neutral_language.js) — nouveau : page /mon-espace (espace personnel, assistant langage neutre sans API).
- addons/parentsolo_website/ — nouveau : premier module Odoo réel (chantier D), pilote /mon-espace + API publique lecture seule du canal Général. Déploiement : voir addons/parentsolo_website/README.md.
- docs/recherche-developpement-8-12-ans-2026-09-05.md — nouveau : sources pour l'extension 8-12 ans.

### Backlog (mises à jour)
- Espace personnel : notifications e-mail = backlog (décision Julien 06/09 : tout in-app pour l'instant) ; résolution serveur du co-parent par e-mail → res.partner (x_coparent_partner_id) = backlog ; export/ICS du calendrier = backlog.
- Messagerie : brancher l'assistant langage neutre (`window.ParentSoloNeutral.analyze`) dans build_messaging_widget.py avant l'envoi dans un canal coparental ; brancher l'affichage anonyme du canal Général sur /parentsolo/api/general-messages.
- Chantier D suite : migrer les 17 pages vers views/ du module après validation du pilote ; migrer x_parentsolo_* vers des classes Python (migration de données à planifier).
- Chantier B : rédaction 8-12 ans à faire (recherche prête), trous BE/CH à afficher explicitement.
- Chantier C : outils Canva absents de la session n°2 → SVG natif.
