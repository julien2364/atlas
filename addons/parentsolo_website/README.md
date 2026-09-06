# parentsolo_website — module Odoo réel du site Parents Solo (Chantier D)

_Session Claude n°2, 06/09/2026. Pilote : `/mon-espace` + API publique lecture seule de la messagerie._

## Ce que contient le module

| Fichier | Rôle |
|---|---|
| `__manifest__.py` | dépend de `website` + `portal`, charge `views/templates.xml`, hook post-install |
| `__init__.py` | `post_init_hook` : crée l'entrée de menu « Mon espace » sur le site n°11 (idempotent) |
| `controllers/main.py` | route `/mon-espace` (auth public, website=True → template QWeb) ; `GET /parentsolo/api/general-messages` (auth public, lecture seule, canaux « général » uniquement) |
| `views/templates.xml` | template `parentsolo_website.mon_espace` qui fait **`t-call="website.layout"`** |
| `static/src/js/mon_espace_app.js` | application de l'espace personnel (identique à `scripts/mon_espace_app.js`, sauf lecture des courbes via `data-curves`) |
| `static/src/js/neutral_language.js` | assistant langage neutre (règles, sans API) |
| `static/src/css/mon_espace.css` | CSS de l'app + classes partagées `.card/.headline/.btn` reprises de `build_pages.py` |

Les modèles restent les modèles manuels `x_parentsolo_*` (créés par `scripts/build_espace_backend.py` et `scripts/build_messaging_backend.py`). Le module ne crée aucun modèle : il peut être installé/désinstallé sans toucher aux données.

## Avant d'installer — 2 vérifications obligatoires

1. **Noms de la messagerie** : ouvrir `scripts/build_messaging_backend.py` et aligner le dictionnaire `MESSAGING` en tête de `controllers/main.py` (modèle des messages, champ canal, champ corps, champ auteur, champ « masqué »). Tant que ce n'est pas fait, l'endpoint répond `503 {"error": "messaging_config", "detail": "..."}` — il ne renvoie jamais de données fausses.
2. **Backend du chantier A déployé** : `python3 scripts/build_espace_backend.py` doit avoir tourné (modèles `x_parentsolo_child`, etc.), sinon la page se charge mais l'app affiche une erreur « modèle inconnu ».

## Déploiement sur le VPS (Docker Compose, VPS partagé — prudence)

```bash
# 1. Depuis le Mac : copier le module dans le dossier des addons custom du VPS
#    (chemin à confirmer sur place : voir docker-compose.yml, volume monté sur /mnt/extra-addons)
ssh dyonysos-vps 'grep -n "addons" /home/ubuntu/infra/odoo/docker-compose.yml'
scp -r addons/parentsolo_website dyonysos-vps:/home/ubuntu/infra/odoo/addons/   # adapter au chemin trouvé

# 2. Sur le VPS : installer (première fois) ou mettre à jour, SANS toucher au docker-compose.yml
ssh dyonysos-vps
cd /home/ubuntu/infra/odoo
docker compose exec odoo odoo -d dyonysos -i parentsolo_website --stop-after-init   # 1re installation
# mises à jour suivantes :
docker compose exec odoo odoo -d dyonysos -u parentsolo_website --stop-after-init
docker compose restart odoo
```

Si `docker compose exec` n'est pas possible (conteneur non nommé `odoo`), utiliser le backend : Apps → Mettre à jour la liste des applications → chercher « Parents Solo — site (module réel) » → Installer. Il faut que le dossier soit dans un `addons_path` du conteneur.

## Après installation — tests

1. `https://<domaine>/mon-espace` en navigation privée → carte de connexion + mention RGPD, **dans le header/footer du site** (preuve que `website.layout` est bien appelé : le menu Odoo apparaît, ce qui n'est pas le cas des pages HTML brut).
2. Connecté avec un compte portail A → créer un enfant, une mesure, un événement partagé.
3. Connecté avec un compte portail B (autre e-mail) → **ne doit voir aucun enfant de A**. Puis A renseigne l'e-mail de B comme co-parent → B voit l'enfant et l'événement partagé, mais pas les événements non partagés de A.
4. `curl -s "https://<domaine>/parentsolo/api/general-messages?country=fr"` sans cookie → JSON `{"channel": {...}, "messages": [...], "read_only": true}` ; `?country=xx` → 400 ; aucun POST accepté.
5. L'ancienne `website.page` `/mon-espace` créée par `scripts/update_mon_espace.py` (si elle a été déployée) devient inutile : le contrôleur a priorité sur les pages statiques. La dépublier depuis le backend (Site web → Pages) pour éviter toute confusion, ou la supprimer.

## Étapes suivantes (après validation du pilote)

- Migrer les 17 pages une par une vers des templates dans `views/` (une route par page ou une route générique `/<slug>` lisant un template `parentsolo_website.page_<slug>`), puis retirer les scripts `update_*.py` correspondants de `deploy_all.py`.
- Migrer `x_parentsolo_*` vers des classes `models.Model` (avec vues formulaire/liste pour Julien) — migration de données à prévoir, ne pas le faire à chaud.
- Widget de messagerie : consommer `/parentsolo/api/general-messages` pour l'affichage anonyme du canal Général ; l'écriture reste réservée aux comptes (call_kw).
