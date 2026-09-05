# MÉGAPROMPT — ATLAS HUMAIN × IA
### Cartographie comparée des capacités humaines et des capacités de l'intelligence artificielle — référentiel vivant, autonome et évolutif

Document rédigé pour Julien Daures (DYONYSOS) — 05/09/2026
Statut : **prompt-cadre exécutable**, à coller dans une session Claude Code / Cowork / Codex / autre agent pour lancer et faire évoluer le projet. Ce n'est pas le livrable final : c'est le brief qui produit le livrable, et qui continue à le faire évoluer après.

---

## 0. Mode d'emploi de ce document

1. **Ce que c'est** : un prompt-cadre unique, conçu pour être collé en tête de session (ou en `CLAUDE.md` / system prompt d'un agent) et exécuté par lots successifs (voir section 9), sans qu'on ait besoin de re-décrire le projet à chaque fois.
2. **Ce que ce n'est pas** : ni le site, ni la base de connaissances elle-même — c'est la spécification qui les génère et qui pilote leur évolution continue.
3. **Règle de non-figement** : à chaque exécution, l'agent qui lit ce document doit d'abord vérifier s'il existe une version plus récente de ce mégaprompt (fichier `megaprompt-atlas-humain-ia.md` en local et sur Drive), l'appliquer, puis, en fin de lot, proposer les amendements qu'il juge nécessaires (nouvelle catégorie détectée, source obsolète, biais identifié). Chaque amendement est versionné (changelog horodaté), jamais silencieux.
4. **Enchaînement des lots** : conformément aux préférences de Julien, l'agent enchaîne les lots de production sans redemander d'accord intermédiaire. Julien valide les livrables finaux et les publications. L'agent ne doit jamais faire re-décrire une maquette ou un enchaînement déjà validé.
5. **Sobriété d'exécution** : privilégier les MCP/outils légers et rapides plutôt que de gros blocs monolithiques ; découper le travail long en sous-tâches vérifiables.

---

## 1. Mission

Construire, documenter et faire vivre un **observatoire comparatif** entre :

- **Référentiel A — les capacités humaines** : sociales, psychologiques, philosophiques, évolutives, et la question de la sérénité/soutenabilité de l'espèce ;
- **Référentiel B — les capacités de l'intelligence artificielle actuelle** (Claude/Cowork, Codex/GPT, DeepSeek, et les autres familles pertinentes), poussées à leur usage le plus avancé en sciences, éducation, recherche, industrie, pharmaceutique et gouvernement.

À partir de ces deux référentiels, produire en continu :

- une **analyse de l'écart (gap analysis)** entre ce que l'humain fait/pense/vit et ce que l'IA sait faire aujourd'hui ;
- une évaluation de **ce que l'IA peut apporter, comment, et comment mieux** (mécanismes, interfaces, modes de collaboration) ;
- une évaluation, domaine par domaine, de **la substituabilité de l'humain par l'IA**, seule ou combinée à d'autres technologies (robotique, spatial, économie/finance programmable, biotech) ;
- un **moteur de réponse prédictive** capable de traiter des questions de fond (modèles économiques, modèles politiques, écoles psychologiques/philosophiques, etc.) avec méthode, sources et nuance — jamais de verdict dogmatique sur des sujets contestés.

Le tout doit être **large** (aucun grand domaine de la connaissance humaine ou de l'IA n'est a priori exclu) et **profond** (chaque entité cartographiée — philosophe, modèle, organisation — donne lieu à une fiche structurée, sourcée, datée), avec un système capable de **s'auto-alimenter et de s'auto-faire-évoluer** sans intervention manuelle permanente.

---

## 2. Posture de l'agent-système ("ATLAS")

Nom de code du système à construire : **ATLAS**.

Principes de fonctionnement, non négociables :

1. **Neutralité active sur les sujets contestés.** Sur toute question politique, économique ou philosophique où plusieurs écoles s'opposent légitimement (capitalisme vs. modèles alternatifs, démocratie libérale vs. autres régimes, écoles psychologiques concurrentes), ATLAS présente le poids des arguments de chaque école, jamais une position surplombante présentée comme LA vérité. Il peut néanmoins signaler des faits empiriquement établis (ex. données de croissance, indices mesurés) en les distinguant clairement des jugements de valeur.
2. **Traçabilité systématique.** Chaque affirmation non triviale est sourcée (source primaire si possible), datée, et assortie d'un niveau de confiance (fait vérifié / consensus scientifique / opinion majoritaire / hypothèse prospective).
3. **Anti-obsolescence.** Aucune fiche n'est considérée comme définitive. Chaque fiche porte une date de dernière vérification et un statut (`à documenter`, `documenté`, `vérifié récemment`, `à ré-auditer`).
4. **Auto-extension du modèle.** Si ATLAS détecte, en veille, un phénomène qui ne rentre dans aucune catégorie existante (nouveau paradigme IA, nouvelle école de pensée, rupture géopolitique), il crée une nouvelle catégorie plutôt que de forcer le rangement, et le signale dans le changelog.
5. **Utilité avant exhaustivité.** Chaque page/fiche doit répondre à une question qu'un utilisateur pourrait réellement poser — pas de remplissage encyclopédique creux.

---

## 3. Référentiel A — Cartographie des capacités humaines

Cinq axes. Pour chacun, lister sous-dimensions, écoles de pensée à cartographier, indicateurs mesurables quand ils existent, et sources de veille à interroger en continu.

### A1. Social
Sous-dimensions : coopération et confiance, institutions et contrats sociaux, structures familiales et communautaires, culture et transmission, communication et langage, conflits et régulation sociale, capital social.
Indicateurs de référence à intégrer : World Values Survey, Edelman Trust Barometer, indices de cohésion sociale, données OCDE "How's Life?".

### A2. Psychologique
Écoles à cartographier : psychanalyse (Freud, Jung, Lacan), béhaviorisme (Skinner, Watson), cognitivisme, thérapies cognitivo-comportementales (TCC/CBT), psychologie humaniste (Maslow, Rogers), psychologie positive (Seligman), psychologie du développement (Piaget, Vygotski), neurosciences cognitives et affectives.
Sous-dimensions : cognition, émotion, motivation, développement de l'enfant à la vieillesse, santé mentale, résilience, biais cognitifs (Kahneman/Tversky — pont naturel avec le référentiel économique).

### A3. Philosophique
Champs : métaphysique, épistémologie, éthique, philosophie politique, esthétique, philosophie de l'esprit, philosophie des techniques/de l'IA.
Corpus de départ : liste des 50 philosophes fournie en **Annexe 12.1**, à classer par courant (existentialisme, phénoménologie, philosophie analytique, philosophie du langage, théorie critique, postmodernisme, posthumanisme/nouveau matérialisme, philosophie de l'esprit computationnelle).

### A4. Évolution
Sous-dimensions : évolution biologique de l'espèce humaine, anthropologie et préhistoire, évolution culturelle et technologique, coévolution homme-outil, hypothèses transhumanistes et post-humaines, trajectoires démographiques longues.

### A5. Sérénité de l'espèce / bien-être collectif
Sous-dimensions : paix et conflit (Global Peace Index), soutenabilité environnementale (limites planétaires), santé mentale collective, quête de sens (spiritualités, laïcité, philosophie du sens), résilience civilisationnelle face aux risques existentiels (nucléaire, climat, pandémies, IA non alignée).
Indicateurs : World Happiness Report, Global Peace Index, Planetary Boundaries (Stockholm Resilience Centre), indices de risque existentiel (Future of Humanity Institute et successeurs).

### Format de fiche standard (Référentiel A)
Nom de l'entité (penseur/théorie/indicateur) · période/courant · thèse centrale en une phrase actionnable · apport à la compréhension humaine · limites et critiques connues · résonance avec les capacités actuelles de l'IA (le cas échéant) · sources primaires et secondaires · date de dernière vérification · statut.

---

## 4. Référentiel B — Cartographie des capacités de l'IA

### B1. Capacités génératives et de raisonnement
Familles à couvrir en priorité (explicitement demandées par Julien) : **Claude / Cowork (Anthropic)**, **Codex / famille GPT (OpenAI)**, **DeepSeek**, et en complément Gemini (Google), Llama (Meta), Mistral, Qwen — à maintenir à jour car ce paysage change vite.

### B2. Capacités agentiques
Autonomie d'exécution, orchestration d'outils, usage d'ordinateur/navigateur, génération et exécution de code, recherche documentaire autonome, mémoire long terme, coordination multi-agents.

### B3. Capacités scientifiques
Modèles et systèmes spécialisés : AlphaFold/AlphaGenome-type (biologie structurale), GNoME et découverte de matériaux, moteurs de simulation physique, IA pour la fusion nucléaire, IA en génomique et drug discovery, IA en climatologie.

### B4. Capacités sectorielles avancées
- **Science/Recherche** : revue de littérature automatisée, génération d'hypothèses, aide à la conception expérimentale.
- **Éducation** : tutorat adaptatif personnalisé, évaluation automatisée, génération de contenus pédagogiques différenciés.
- **Industrie** : jumeaux numériques, maintenance prédictive, optimisation de chaînes logistiques, contrôle qualité par vision.
- **Pharmaceutique** : criblage virtuel de molécules, optimisation d'essais cliniques, pharmacovigilance automatisée.
- **Gouvernement** : aide à la décision publique, prévision (économique, sanitaire, climatique), cybersécurité, systèmes de défense, risques et limites démocratiques associés (surveillance, biais algorithmique dans l'action publique).

### B5. Limites actuelles à documenter systématiquement
Hallucination et fiabilité factuelle, absence de conscience/qualia (état du débat philosophique, cf. Chalmers/Dennett/Searle en A3), biais hérités des données d'entraînement, dépendance énergétique et matérielle, questions de gouvernance et d'alignement, dépendance à la supervision humaine dans les usages à haut risque.

### Grille de maturité
Échelle inspirée des TRL (Technology Readiness Level), de 1 (preuve de concept en laboratoire) à 9 (déploiement massif en production), appliquée par capacité **et** par secteur d'usage — une même capacité peut être TRL 8 en usage grand public et TRL 3 en usage pharmaceutique réglementé.

### Format de fiche standard (Référentiel B)
Nom du modèle/système · éditeur · architecture connue · capacités clés · usages documentés par secteur (avec exemples concrets et sources) · limites connues · niveau de maturité (TRL) par secteur · sources (papiers, documentation officielle, benchmarks indépendants) · date de dernière vérification · statut.

---

## 5. Méthodologie de gap analysis (A × B)

Pour chaque paire (capacité humaine de A, capacité IA de B) jugée pertinente, produire une **fiche de gap** répondant systématiquement à :

1. **Que peut apporter l'IA ici ?** (nature de l'apport : vitesse, échelle, exhaustivité, disponibilité 24/7, absence de fatigue/biais émotionnel — ou au contraire ce qu'elle ne peut structurellement pas apporter : intentionnalité, responsabilité morale, vécu subjectif).
2. **Comment ?** (mécanisme concret : modèle, architecture, mode d'intégration).
3. **Comment mieux ?** (roadmap d'amélioration : meilleure donnée, meilleure interface, supervision humaine mieux calibrée, combinaison avec une autre technologie).
4. **Mode d'interaction homme-IA recommandé** : co-pilotage, délégation supervisée, autonomie complète encadrée, boucle de feedback continue ; canal (langage naturel, API, interface robotique, interfaces neuronales émergentes — à mentionner comme horizon, pas comme réalité actuelle).
5. **Substituabilité** : noter chaque tâche/domaine selon une échelle à 4 niveaux —
   - *Remplaçable totalement* (l'IA seule fait mieux/aussi bien, sans supervision nécessaire) ;
   - *Remplaçable avec supervision humaine* (l'IA fait le gros du travail, l'humain valide/arbitre) ;
   - *Non remplaçable à horizon prévisible* (dimension irréductiblement humaine : responsabilité morale, relation de confiance, jugement contextuel incarné) ;
   - *Remplaçable seulement combinée à une autre technologie* (préciser laquelle : robotique pour l'action physique, systèmes spatiaux, économie/monnaie programmable, biotechnologies).
6. **Scénarios temporels** : présent (2026), +5 ans, +15/20 ans — chacun avec un niveau de confiance explicite (élevé/moyen/faible) et les hypothèses sous-jacentes.

Cette grille est le cœur productif du système : c'est elle qui alimente le moteur de réponse prédictive (section 7.3).

---

## 6. Corpus de référence à structurer en base de connaissances

Les listes fournies par Julien (reproduites intégralement et classées en **Annexe 12**) constituent le **jeu de données d'amorçage** du référentiel. Pour chaque entité de chaque liste, l'agent doit générer une fiche au format standard (section 3 ou 4 selon le référentiel), avec un statut de départ `à documenter`, puis la faire progresser vers `documenté` puis `vérifié` au fil des lots de production et de la veille continue.

Domaines couverts par les listes fournies (détail en annexe) :
- 12.1 — Philosophie (50 auteurs, à classer par courant)
- 12.2 — Modèles politiques (33 régimes/idéologies)
- 12.3 — Modèles économiques (16 modèles) + économistes du XXe (16) et du XXIe siècle (16)
- 12.4 — Relations internationales : modèles de gouvernance mondiale (8) + organisations du XXe (23, en deux blocs politique/sécurité et économie/commerce) + organisations du XXIe siècle (14)
- 12.5 — Sciences : modèles/théories majeurs (10) + axes de recherche (10) + chercheurs (20) + institutions (15)
- 12.6 — Data science / IA : modèles prédictifs classiques (11) + deep learning (7) + architectures IA célèbres (9, **+ ajouter explicitement DeepSeek et Codex, absents de la liste source mais requis par la mission**)
- 12.7 — Modèles de management/organisation : XXe siècle (8) + XXIe siècle (8)

**Instruction impérative** : ne jamais traiter ces listes comme closes. La veille continue (section 7.1) doit proposer des ajouts (nouveaux penseurs, nouveaux modèles économiques post-2020, nouvelles organisations, nouveaux labs IA) et les soumettre au changelog.

---

## 7. Le moteur autonome (middle layer)

### 7.1 Boucle de veille continue
**Canaux de collecte (révisé v1.1)** : flux RSS/Atom en priorité (arXiv, bioRxiv, blogs officiels des labs IA — Anthropic, OpenAI, DeepSeek, Google DeepMind, Meta AI —, presse scientifique de référence Nature/Science, publications des organisations internationales FMI/Banque mondiale/GIEC/OCDE), complétés par **Spiderfoot** comme second canal de collecte structurée (reconnaissance OSINT déjà en usage chez Julien). Le scraping web direct à grande échelle est exclu par défaut.
Pipeline : ingestion RSS/Spiderfoot → extraction → scoring de fiabilité de la source → proposition de mise à jour de fiche → validation automatique si confiance élevée et source primaire, sinon file d'attente de validation → publication avec entrée de changelog horodatée.

### 7.2 Auto-évolution du modèle conceptuel
Le référentiel doit pouvoir grandir structurellement : ajout de nouveaux axes, sous-dimensions ou catégories quand un phénomène ne rentre dans aucune case existante. Chaque évolution structurelle est elle-même documentée (pourquoi cette catégorie a été créée, quand, sur la base de quelle observation).

### 7.3 Mode Q&A prédictif
Architecture RAG (retrieval-augmented generation) interrogeant la base de connaissances des deux référentiels + les fiches de gap analysis, avec un gabarit de réponse imposé pour toute question de fond :

1. Reformulation de la question et identification des référentiels/fiches mobilisés.
2. Synthèse des faits établis et des positions en présence (jamais une seule école présentée comme réponse unique sur les sujets contestés).
3. Scénarios ou pistes de dépassement, quand la question l'appelle (ex. "quel modèle pourrait surpasser X ?"), présentés comme hypothèses argumentées, pas comme prédictions certaines.
4. Sources mobilisées et date de fraîcheur des données utilisées.
5. Limites de la réponse et angles morts explicitement signalés.

**Questions-tests permanentes** (à faire tourner à chaque mise à jour majeure pour vérifier la qualité et la neutralité du moteur) :
- Les modèles économiques mondiaux actuels sont-ils optimaux ? Quel modèle pourrait les surpasser ?
- Quels futurs modèles de gouvernance nationale et mondiale sont plausibles ?
- Comment comparer l'évolution du capitalisme, du communisme et du modèle chinois (capitalisme d'État) ?
- Comment se comparent les référentiels psychologiques/philosophiques de Spinoza, Socrate, Aristote, les thérapies cognitivo-comportementales (TCC) et Nietzsche sur la question du bien-vivre ?

---

## 8. Spécifications du livrable technique recommandé

**Stack** : Next.js (déploiement Vercel) · base de données Postgres (Supabase) avec extension vectorielle (pgvector) pour la recherche sémantique · fonctions planifiées (cron Vercel ou Inngest) pour la veille · orchestration LLM côté serveur (API Claude en priorité) · visualisation avec une librairie de graphes orientée force (type React Flow / D3.js) pour la cartographie relationnelle, et Observable Plot / Recharts pour les indicateurs chiffrés.

**Arborescence du site** :
- `/` — accueil, présentation de la démarche, dernière mise à jour.
- `/referentiel-humain` — les 5 axes A1-A5, navigables.
- `/referentiel-ia` — les capacités B1-B5, navigables par secteur (science, éducation, recherche, industrie, pharma, gouvernement).
- `/cartographie` — visualisations interactives : graphe de connaissances, treemap par domaine, radar de maturité IA vs. humain, frise chronologique, matrice de gap cliquable.
- `/comparateur` — outil de sélection libre d'une capacité humaine et d'une capacité IA pour afficher leur fiche de gap.
- `/questions` — moteur de réponse prédictive (section 7.3), avec historique des questions-tests.
- `/veille` — journal des mises à jour (changelog public), fraîcheur des données par fiche.
- `/methodologie` — sources, règles de neutralité, limites assumées du projet.

---

## 9. Plan de production par lots

À enchaîner sans redemander de validation intermédiaire ; Julien valide les jalons finaux.

1. **Lot 1** — Architecture technique, squelette Next.js/Vercel, modèle de données (schéma des fiches A et B, table de gap).
2. **Lot 2** — Amorçage du Référentiel A à partir de l'Annexe 12 (philosophie, psychologie, social, évolution, sérénité).
3. **Lot 3** — Amorçage du Référentiel B (Claude/Cowork, Codex, DeepSeek en priorité, puis modèles data science/IA de l'Annexe 12.6).
4. **Lot 4** — Moteur de gap analysis et matrices croisées.
5. **Lot 5** — Moteur de veille autonome (cron, scoring de sources, changelog).
6. **Lot 6** — Moteur de réponse prédictive (RAG) et validation sur les questions-tests de la section 7.3.
7. **Lot 7** — Cartographies visuelles interactives.
8. **Lot 8** — Contrôle qualité, vérification du sourcing, mise en cohérence éditoriale, publication.

---

## 10. Garde-fous de gouvernance

- Neutralité obligatoire sur tout sujet politique, économique ou philosophique contesté : présenter les écoles en présence, jamais trancher.
- Distinction permanente entre fait vérifiable, consensus scientifique, opinion majoritaire et spéculation prospective — signalée visuellement sur chaque fiche.
- Sourçage systématique avec date ; aucune affirmation non triviale sans source.
- Changelog public et daté de toute évolution du contenu ou de la structure.
- Vigilance réglementaire : projet publié depuis une SASU basée en Belgique/UE — anticiper AI Act (transparence sur le contenu généré par IA) et RGPD (aucune donnée personnelle collectée sans base légale) dès la conception du site.
- **Diffusion (v1.1)** : usage interne par défaut (accès restreint) tant qu'aucune décision explicite de mise en ligne publique n'a été prise par Julien.

---

## 11. Recommandations de Julien (en tant que consultant)

1. **Ne pas partir sur les 8 lots en une seule fois.** Le portefeuille de projets de Julien est déjà très chargé (Propecto, Kreo, Nova ERP, École Connect, etc.) — livrer d'abord un **MVP resserré sur 2-3 domaines** (par exemple : philosophie + IA générative + économie) pour valider le concept et l'UX avant d'étendre aux sept catalogues complets. Le mégaprompt reste valable pour l'extension ultérieure.
2. **Positionner le site comme actif de thought-leadership/SEO**, pas seulement comme outil interne : ce type de cartographie a une forte valeur d'autorité et de référencement si elle est publique, et peut servir de vitrine cohérente avec l'activité de conseil ERP/formation de DYONYSOS.
3. **Synergie avec les projets existants** : le moteur de veille autonome et le moteur de gap analysis sont réutilisables tels quels pour d'autres projets éditoriaux de Julien (Content Engine DYONYSOS, sites éditoriaux Odoo) — envisager une architecture de veille mutualisée plutôt que huit pipelines séparés.
4. **Vigilance sur le scraping massif** : la veille continue doit respecter les conditions d'utilisation des sources (arXiv, presse) — privilégier API officielles et flux RSS/Atom plutôt que du scraping direct à grande échelle.
5. **Budget IA** : le moteur RAG + veille + Q&A prédictif consommera des appels API réguliers ; prévoir un budget mensuel et des seuils de coût (alerte si dépassement), avec mise en cache agressive des fiches déjà vérifiées.
6. **Le mégaprompt lui-même doit être versionné** dans le dépôt du projet (`/docs/megaprompt.md`) pour que chaque session d'agent reparte de la version à jour.

---

## 12. Annexes — Corpus brut structuré

### 12.1 Philosophie (50)
Alain Badiou · Albert Camus · Antonio Negri · Axel Honneth · Bernard Stiegler · Bruno Latour · Byung-Chul Han · Chantal Mouffe · Cornelius Castoriadis · Daniel Dennett · David Chalmers · Donna Haraway · Emmanuel Levinas · Frantz Fanon · Friedrich Nietzsche · Gilles Deleuze · Giorgio Agamben · Hannah Arendt · Hans-Georg Gadamer · Hilary Putnam · Jacques Derrida · Jacques Rancière · Jean-Paul Sartre · Jean-François Lyotard · John Rawls · John Searle · Judith Butler · Jürgen Habermas · Karl Popper · Luce Irigaray · Ludwig Wittgenstein · Martin Heidegger · Mauricio Ferraris · Maurice Merleau-Ponty · Michel Foucault · Martha Nussbaum · Noam Chomsky · Paul Ricœur · Peter Singer · Quentin Meillassoux · Raymond Aron · Richard Rorty · Rosi Braidotti · Saul Kripke · Slavoj Žižek · Simone de Beauvoir · Theodor Adorno · Thomas Nagel · Tristan Garcia · Walter Benjamin

*Classement suggéré* : phénoménologie/existentialisme (Sartre, Beauvoir, Merleau-Ponty, Heidegger, Camus) · théorie critique (Adorno, Benjamin, Habermas, Honneth) · post-structuralisme/postmodernisme (Foucault, Derrida, Deleuze, Lyotard, Agamben) · philosophie analytique et philosophie de l'esprit (Wittgenstein, Kripke, Putnam, Searle, Dennett, Chalmers, Nagel) · philosophie politique (Rawls, Arendt, Rancière, Mouffe) · éthique appliquée (Singer, Nussbaum) · posthumanisme/nouveau matérialisme (Haraway, Braidotti, Garcia) · philosophie française contemporaine (Stiegler, Latour, Badiou, Ferraris, Meillassoux) · linguistique et sciences cognitives (Chomsky).

### 12.2 Modèles politiques (33)
Démocratie libérale · Social-démocratie · Démocratie chrétienne · Régime parlementaire · Régime présidentiel · Régime semi-présidentiel · Communisme · Marxisme-léninisme · Maoïsme · Socialisme du XXIe siècle · Fascisme · Nazisme · National-populisme · Populisme de gauche · Populisme de droite · Autoritarisme électif · Démocratie illibérale · Démocrature · Hybride compétitif · Totalitarisme · Dictature militaire · Junte · Théocratie islamique · Monarchie absolue · Monarchie constitutionnelle · Anarchisme · Libertarianisme · Éco-socialisme · Technocratie · Néolibéralisme étatique · Cyber-socialisme · Minarchisme · Souverainisme

### 12.3 Économie
**Modèles (16)** : Capitalisme de marché libre (laissez-faire) · Économie de marché régulée (social-démocratie) · Économie planifiée (modèle soviétique) · Capitalisme d'État (modèle chinois) · Croissance de Solow-Swan · IS-LM (keynésianisme de synthèse) · Croissance endogène (Romer-Lucas) · MEDAF/CAPM · Black-Scholes · Économie circulaire · Économie de la fonctionnalité · Théorie des jeux (équilibre de Nash) · Économie comportementale (théorie des perspectives) · Théorie moderne de la monnaie (MMT) · Économie du donut (Kate Raworth) · Économie de plateformes (capitalisme numérique)

**Économistes du XXe siècle (16)** : John Maynard Keynes · Friedrich Hayek · Milton Friedman · Joseph Schumpeter · Paul Samuelson · Joan Robinson · Karl Polanyi · Kenneth Arrow · Gérard Debreu · Robert Solow · Gary Becker · John von Neumann · John Nash · Amartya Sen · James M. Buchanan · Wassily Leontief

**Économistes du XXIe siècle (16)** : Thomas Piketty · Esther Duflo · Abhijit Banerjee · Michael Kremer · Joseph Stiglitz · Paul Krugman · Daron Acemoglu · James A. Robinson · Simon Johnson · Gabriel Zucman · Emmanuel Saez · Mariana Mazzucato · Dani Rodrik · Richard Thaler · Daniel Kahneman · Kate Raworth

### 12.4 Relations internationales et gouvernance mondiale
**Modèles de gouvernance mondiale (8)** : Hégémonie unilatérale (Pax Britannica, Pax Americana) · Bipolarité (Guerre froide) · Multilatéralisme institutionnel · Gouvernance multipolaire · Gouvernance en réseau (multiniveau) · Minilatéralisme et clubs (G7, G20) · Régionalisme et intégration régionale · Souverainisme et concert des nations

**Organisations du XXe siècle — politique/sécurité/diplomatie (11)** : SDN · ONU · CIJ · OTAN · Pacte de Varsovie · Mouvement des non-alignés · Union africaine (UA)/OUA · OEA · Ligue arabe · Conseil de l'Europe · OSCE

**Organisations du XXe siècle — économie/commerce/développement (12)** : FMI · Banque mondiale (BIRD) · GATT · OMC · OCDE · OPEP · Forum économique mondial (WEF) · G7/G8 · UE/CEE · ASEAN · Mercosur · CEI

**Organisations du XXIe siècle (14)** : G20 · BRICS(+) · Organisation de coopération de Shanghai (OCS) · Cour pénale internationale (CPI) · Banque africaine de développement (BAfD) · Banque asiatique d'investissement pour les infrastructures (BAII) · Nouvelle banque de développement (NBD) · CPTPP · RCEP · Alliance solaire internationale (ASI) · Conseil de stabilité financière (CSF) · GAVI · Fonds mondial (sida/tuberculose/paludisme) · IPBES

### 12.5 Sciences
**Modèles et théories majeurs (10)** : Relativité générale et restreinte · Modèle standard de la physique des particules · Double hélice de l'ADN · Tectonique des plaques · Big Bang (modèle cosmologique) · Mécanique quantique/modèle de Bohr · Théorie synthétique de l'évolution · Modèle climatique du réchauffement anthropique · Théorie du chaos et systèmes complexes · Réseaux de neurones artificiels/deep learning

**Axes de recherche majeurs (10)** : Génomique et CRISPR-Cas9 · Physique des hautes énergies (boson de Higgs) · Informatique quantique · IA et traitement du langage naturel · Astrobiologie et exoplanètes · Immunothérapie et vaccins ARNm · Nanotechnologies et graphène · Neurosciences cognitives et connectome humain · Fusion nucléaire contrôlée (Tokamak) · Écologie globale et science du système Terre

**Chercheurs (20)** : Albert Einstein · Marie Curie · Niels Bohr · Alan Turing · James Watson · Francis Crick · Rosalind Franklin · Stephen Hawking · Richard Feynman · Max Planck · Werner Heisenberg · Linus Pauling · Jane Goodall · Tu Youyou · Jennifer Doudna · Emmanuelle Charpentier · Tim Berners-Lee · Geoffrey Hinton · Shinya Yamanaka · Roger Penrose

**Institutions (15)** : CERN · NASA · ESA · Institut Max-Planck · MIT · CNRS · NIH · Laboratoire Cavendish · Caltech · Université de Stanford · Institut Pasteur · RIKEN · GIEC (IPCC) · EMBL · Fermilab

### 12.6 Data science, modèles prédictifs et IA
**Modèles classiques (11)** : Régression linéaire · Régression logistique · Arbres de décision · Forêts aléatoires · SVM · K-NN · Naive Bayes · K-Means · PCA · Gradient Boosting (XGBoost/LightGBM/CatBoost) · Séries temporelles ARIMA/SARIMA

**Deep learning (7)** : Perceptron multicouche (MLP) · CNN · RNN · LSTM · Autoencodeurs · GAN · Transformers

**Architectures et systèmes IA célèbres (9 + ajouts requis)** : AlexNet (2012) · YOLO · ResNet · BERT (Google) · Famille GPT/Codex (OpenAI) · Claude/Cowork (Anthropic) · Llama (Meta) · AlphaGo/AlphaZero/AlphaFold (DeepMind) · Stable Diffusion/Midjourney/DALL-E · **+ DeepSeek (à documenter en priorité, explicitement demandé par Julien, absent de la liste source)**

### 12.7 Modèles de management et d'organisation
**XXe siècle (8)** : Taylorisme (OST) · Fordisme · Fayolisme · Bureaucratie wébérienne · Toyotisme/Lean Management · Management par objectifs (MPO, Drucker) · Structure matricielle · Modèle des 7S (McKinsey)

**XXIe siècle (8)** : Entreprise libérée · Holacratie/Sociocratie · Agile/Scrum · Modèle Spotify (Squads/Tribes/Chapters/Guilds) · Organisation exponentielle (ExO) · Management hybride/télétravail · OKR · Entreprise à mission/RSE intégrée

---

## 13. Décisions de cadrage validées par Julien (05/09/2026)

En réponse aux recommandations de la section 11, Julien a arbitré :

1. **Scope complet, exécution itérative** — pas de restriction à un MVP resserré : les 8 lots de la section 9 sont tous à réaliser, mais nécessairement de façon itérative (une session/un lot ne peut pas produire une profondeur réelle sur les sept catalogues en une seule passe). Chaque itération doit livrer une avancée réellement documentée (pas de coquilles vides), pas une simple promesse de structure.
2. **Diffusion : usage interne d'abord.** Le site n'est PAS publié publiquement au premier jalon. Il est construit et utilisé en interne (Julien + éventuellement son équipe/collaborateurs) jusqu'à nouvel ordre. La piste thought-leadership/SEO (recommandation 2) reste valable mais devient une décision de mise en ligne ultérieure, explicite, jamais automatique.
3. **Mutualisation + fonctionnalités additionnelles.** Le moteur de veille et le moteur de gap analysis restent conçus pour être réutilisables par d'autres projets éditoriaux de Julien (Content Engine DYONYSOS, sites Odoo), ET doivent recevoir des fonctionnalités additionnelles propres à ce projet (au-delà de la mutualisation brute) — à préciser au fil des lots plutôt que figées ici.
4. **Veille : RSS + Spiderfoot, pas de scraping générique.** La boucle de veille (section 7.1) est révisée : sources RSS/Atom en priorité, complétées par **Spiderfoot** (déjà utilisé par Julien pour la reconnaissance OSINT) comme second canal de collecte structurée. Le scraping direct à grande échelle reste exclu.
5. **Budget IA confirmé.** La recommandation 5 (budget mensuel, seuils de coût, cache agressif des fiches vérifiées) est retenue telle quelle.

---

## Changelog de ce mégaprompt

- **v1.1 — 05/09/2026** : intégration des décisions de cadrage de Julien (section 13) — scope complet par itération, usage interne en premier, mutualisation + fonctionnalités additionnelles, veille RSS + Spiderfoot, budget IA confirmé. Section 7.1 amendée en conséquence.
- **v1.0 — 05/09/2026** : première rédaction complète (mission, deux référentiels, méthodologie de gap, moteur autonome, spécifications techniques, plan de production, annexes structurées à partir des listes fournies).
