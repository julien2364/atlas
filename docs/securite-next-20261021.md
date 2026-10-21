# Correctif Next.js — 21 octobre 2026

Coordination: intervention Codex autorisee par Julien pour audit, autocorrection et deploiement verifies. Perimetre: dependances uniquement du projet atlas-humain-ia; aucun changement de schema, secret ou regle metier.

Avis editeur: https://nextjs.org/blog/nextjs-security-update-october-14-2026

Version source servie avant intervention: Next 16.3.4 au commit a864c9d599c4245720d43cb3b635e613a69016ff (deploiement dpl_2dnEJc9LXrtxQkV9VdPzqM77HTUc). Version corrigee: 16.4.1. Sharp doit resoudre 0.35.5 ou superieur; les projets Next 15 epinglent explicitement 0.35.5 car la regeneration du lock conservait une ancienne version optionnelle.

Le lock a ete regenere via npm install --package-lock-only --ignore-scripts dans Node 24 isole sur VPS, sans installation ou compilation sur le Mac. Validation de build Vercel et verification HTTP restent a terminer avant promotion. La preparation du correctif ne prouve pas sa mise en production.

Retour arriere: deploiement precedent dpl_2dnEJc9LXrtxQkV9VdPzqM77HTUc / https://atlas-humain-58pgp6dwq-dyonysos.vercel.app. Ne pas modifier les secrets, domaines, protections ou cadences de deploiement pour ce correctif.
