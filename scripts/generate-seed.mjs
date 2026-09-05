// Génère les fichiers de seed (data/seed/*.json) à partir des listes de l'Annexe 12 du mégaprompt.
// Statut par défaut "a_documenter" ; quelques entrées prioritaires sont "documente" (voir DOCUMENTED ci-dessous).
//
// GARDE-FOU (ajouté après incident du 05/09/2026) : de nombreuses fiches sont enrichies MANUELLEMENT
// après génération (directement dans data/seed/*.json), sans toujours être répercutées dans ce script.
// Une ré-exécution naïve écraserait donc ce travail. mergeAvecExistant() empêche toute régression de
// statut : si le fichier existant sur disque a un statut plus avancé pour un id donné, la version
// existante (complète) est conservée telle quelle plutôt que remplacée par la version générée ici.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";

const ORDRE_STATUT = { a_documenter: 0, documente: 1, verifie_recemment: 2, a_re_auditer: 3 };

function mergeAvecExistant(nouvellesFiches, path) {
  if (!existsSync(path)) return nouvellesFiches;
  let existantes;
  try {
    existantes = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    console.warn(`Impossible de lire ${path} pour la fusion protectrice — écriture de la version générée telle quelle.`);
    return nouvellesFiches;
  }
  const existantesParId = new Map(existantes.map((f) => [f.id, f]));
  let preservees = 0;
  const fusionnees = nouvellesFiches.map((nouvelle) => {
    const existante = existantesParId.get(nouvelle.id);
    if (!existante) return nouvelle;
    const rangExistant = ORDRE_STATUT[existante.statut] ?? 0;
    const rangNouveau = ORDRE_STATUT[nouvelle.statut] ?? 0;
    if (rangExistant > rangNouveau) {
      preservees += 1;
      return existante;
    }
    return nouvelle;
  });
  if (preservees > 0) {
    console.log(`  → ${preservees} fiche(s) existante(s) à statut plus avancé préservée(s) sans régression (${path}).`);
  }
  return fusionnees;
}

const TODAY = new Date().toISOString().slice(0, 10);

function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function humaine(nom, axe, sous_domaine, extra = {}) {
  return {
    id: slug(nom),
    axe,
    sous_domaine,
    nom,
    these_centrale: extra.these_centrale ?? "",
    apport: extra.apport ?? "",
    limites_critiques: extra.limites_critiques ?? "",
    resonance_ia: extra.resonance_ia,
    sources: extra.sources ?? [],
    statut: extra.statut ?? "a_documenter",
    derniere_verification: TODAY,
  };
}

function ia(nom, axe, extra = {}) {
  return {
    id: slug(nom),
    axe,
    nom,
    editeur: extra.editeur,
    architecture: extra.architecture,
    capacites_cles: extra.capacites_cles ?? [],
    usages: extra.usages ?? [],
    limites_connues: extra.limites_connues ?? "",
    sources: extra.sources ?? [],
    statut: extra.statut ?? "a_documenter",
    derniere_verification: TODAY,
  };
}

// --- 12.1 Philosophie ---
const PHILOSOPHES = [
  "Alain Badiou","Albert Camus","Antonio Negri","Axel Honneth","Bernard Stiegler","Bruno Latour",
  "Byung-Chul Han","Chantal Mouffe","Cornelius Castoriadis","Daniel Dennett","David Chalmers",
  "Donna Haraway","Emmanuel Levinas","Frantz Fanon","Friedrich Nietzsche","Gilles Deleuze",
  "Giorgio Agamben","Hannah Arendt","Hans-Georg Gadamer","Hilary Putnam","Jacques Derrida",
  "Jacques Rancière","Jean-Paul Sartre","Jean-François Lyotard","John Rawls","John Searle",
  "Judith Butler","Jürgen Habermas","Karl Popper","Luce Irigaray","Ludwig Wittgenstein",
  "Martin Heidegger","Mauricio Ferraris","Maurice Merleau-Ponty","Michel Foucault","Martha Nussbaum",
  "Noam Chomsky","Paul Ricœur","Peter Singer","Quentin Meillassoux","Raymond Aron","Richard Rorty",
  "Rosi Braidotti","Saul Kripke","Slavoj Žižek","Simone de Beauvoir","Theodor Adorno","Thomas Nagel",
  "Tristan Garcia","Walter Benjamin",
];

// --- 12.2 Modèles politiques ---
const MODELES_POLITIQUES = [
  "Démocratie libérale","Social-démocratie","Démocratie chrétienne","Régime parlementaire",
  "Régime présidentiel","Régime semi-présidentiel","Communisme","Marxisme-léninisme","Maoïsme",
  "Socialisme du XXIe siècle","Fascisme","Nazisme","National-populisme","Populisme de gauche",
  "Populisme de droite","Autoritarisme électif","Démocratie illibérale","Démocrature",
  "Hybride compétitif","Totalitarisme","Dictature militaire","Junte","Théocratie islamique",
  "Monarchie absolue","Monarchie constitutionnelle","Anarchisme","Libertarianisme","Éco-socialisme",
  "Technocratie","Néolibéralisme étatique","Cyber-socialisme","Minarchisme","Souverainisme",
];

// --- 12.3 Économie ---
const MODELES_ECONOMIQUES = [
  "Capitalisme de marché libre (laissez-faire)","Économie de marché régulée (social-démocratie)",
  "Économie planifiée (modèle soviétique)","Capitalisme d'État (modèle chinois)",
  "Croissance de Solow-Swan","IS-LM (keynésianisme de synthèse)","Croissance endogène (Romer-Lucas)",
  "MEDAF/CAPM","Black-Scholes","Économie circulaire","Économie de la fonctionnalité",
  "Théorie des jeux (équilibre de Nash)","Économie comportementale (théorie des perspectives)",
  "Théorie moderne de la monnaie (MMT)","Économie du donut (Kate Raworth)",
  "Économie de plateformes (capitalisme numérique)",
];
const ECONOMISTES_XXE = [
  "John Maynard Keynes","Friedrich Hayek","Milton Friedman","Joseph Schumpeter","Paul Samuelson",
  "Joan Robinson","Karl Polanyi","Kenneth Arrow","Gérard Debreu","Robert Solow","Gary Becker",
  "John von Neumann","John Nash","Amartya Sen","James M. Buchanan","Wassily Leontief",
];
const ECONOMISTES_XXIE = [
  "Thomas Piketty","Esther Duflo","Abhijit Banerjee","Michael Kremer","Joseph Stiglitz","Paul Krugman",
  "Daron Acemoglu","James A. Robinson","Simon Johnson","Gabriel Zucman","Emmanuel Saez",
  "Mariana Mazzucato","Dani Rodrik","Richard Thaler","Daniel Kahneman","Kate Raworth",
];

// --- 12.4 Relations internationales ---
const MODELES_GOUVERNANCE_MONDIALE = [
  "Hégémonie unilatérale (Pax Britannica, Pax Americana)","Bipolarité (Guerre froide)",
  "Multilatéralisme institutionnel","Gouvernance multipolaire","Gouvernance en réseau (multiniveau)",
  "Minilatéralisme et clubs (G7, G20)","Régionalisme et intégration régionale",
  "Souverainisme et concert des nations",
];
const ORGANISATIONS_XXE_POLITIQUE = [
  "SDN","ONU","CIJ","OTAN","Pacte de Varsovie","Mouvement des non-alignés",
  "Union africaine (UA) / OUA","OEA","Ligue arabe","Conseil de l'Europe","OSCE",
];
const ORGANISATIONS_XXE_ECO = [
  "FMI","Banque mondiale (BIRD)","GATT","OMC","OCDE","OPEP","Forum économique mondial (WEF)",
  "G7/G8","UE/CEE","ASEAN","Mercosur","CEI",
];
const ORGANISATIONS_XXIE = [
  "G20","BRICS(+)","Organisation de coopération de Shanghai (OCS)","Cour pénale internationale (CPI)",
  "Banque africaine de développement (BAfD)","Banque asiatique d'investissement pour les infrastructures (BAII)",
  "Nouvelle banque de développement (NBD)","CPTPP","RCEP","Alliance solaire internationale (ASI)",
  "Conseil de stabilité financière (CSF)","GAVI","Fonds mondial (sida/tuberculose/paludisme)","IPBES",
];

// --- 12.5 Sciences ---
const MODELES_SCIENTIFIQUES = [
  "Relativité générale et restreinte","Modèle standard de la physique des particules",
  "Double hélice de l'ADN","Tectonique des plaques","Big Bang (modèle cosmologique)",
  "Mécanique quantique / modèle de Bohr","Théorie synthétique de l'évolution",
  "Modèle climatique du réchauffement anthropique","Théorie du chaos et systèmes complexes",
  "Réseaux de neurones artificiels / deep learning",
];
const AXES_RECHERCHE = [
  "Génomique et CRISPR-Cas9","Physique des hautes énergies (boson de Higgs)","Informatique quantique",
  "IA et traitement du langage naturel","Astrobiologie et exoplanètes","Immunothérapie et vaccins ARNm",
  "Nanotechnologies et graphène","Neurosciences cognitives et connectome humain",
  "Fusion nucléaire contrôlée (Tokamak)","Écologie globale et science du système Terre",
];
const CHERCHEURS = [
  "Albert Einstein","Marie Curie","Niels Bohr","Alan Turing","James Watson","Francis Crick",
  "Rosalind Franklin","Stephen Hawking","Richard Feynman","Max Planck","Werner Heisenberg",
  "Linus Pauling","Jane Goodall","Tu Youyou","Jennifer Doudna","Emmanuelle Charpentier",
  "Tim Berners-Lee","Geoffrey Hinton","Shinya Yamanaka","Roger Penrose",
];
const INSTITUTIONS_SCIENTIFIQUES = [
  "CERN","NASA","ESA","Institut Max-Planck","MIT","CNRS","NIH","Laboratoire Cavendish","Caltech",
  "Université de Stanford","Institut Pasteur","RIKEN","GIEC (IPCC)","EMBL","Fermilab",
];

// --- 12.7 Management ---
const MANAGEMENT_XXE = [
  "Taylorisme (OST)","Fordisme","Fayolisme","Bureaucratie wébérienne","Toyotisme / Lean Management",
  "Management par objectifs (MPO, Drucker)","Structure matricielle","Modèle des 7S (McKinsey)",
];
const MANAGEMENT_XXIE = [
  "Entreprise libérée","Holacratie / Sociocratie","Agile / Scrum",
  "Modèle Spotify (Squads/Tribes/Chapters/Guilds)","Organisation exponentielle (ExO)",
  "Management hybride / télétravail","OKR","Entreprise à mission / RSE intégrée",
];

// --- 12.6 Data science / IA ---
const MODELES_CLASSIQUES = [
  "Régression linéaire","Régression logistique","Arbres de décision","Forêts aléatoires","SVM","K-NN",
  "Naive Bayes","K-Means","PCA","Gradient Boosting (XGBoost/LightGBM/CatBoost)",
  "Séries temporelles ARIMA/SARIMA",
];
const DEEP_LEARNING = ["Perceptron multicouche (MLP)","CNN","RNN","LSTM","Autoencodeurs","GAN","Transformers"];
const ARCHITECTURES_CELEBRES = [
  "AlexNet","YOLO","ResNet","BERT","Llama","AlphaGo/AlphaZero/AlphaFold","Stable Diffusion/Midjourney/DALL-E",
];

// Fiches humaines
const fichesHumaines = [
  ...PHILOSOPHES.map((n) => humaine(n, "philosophique", "philosophie")),
  ...MODELES_POLITIQUES.map((n) => humaine(n, "social", "modele_politique")),
  ...MODELES_ECONOMIQUES.map((n) => humaine(n, "social", "economie")),
  ...ECONOMISTES_XXE.map((n) => humaine(n, "social", "economie")),
  ...ECONOMISTES_XXIE.map((n) => humaine(n, "social", "economie")),
  ...MODELES_GOUVERNANCE_MONDIALE.map((n) => humaine(n, "social", "gouvernance_mondiale")),
  ...ORGANISATIONS_XXE_POLITIQUE.map((n) => humaine(n, "social", "organisation_internationale")),
  ...ORGANISATIONS_XXE_ECO.map((n) => humaine(n, "social", "organisation_internationale")),
  ...ORGANISATIONS_XXIE.map((n) => humaine(n, "social", "organisation_internationale")),
  ...MODELES_SCIENTIFIQUES.map((n) => humaine(n, "evolution", "sciences")),
  ...AXES_RECHERCHE.map((n) => humaine(n, "evolution", "sciences")),
  ...CHERCHEURS.map((n) => humaine(n, "evolution", "sciences")),
  ...INSTITUTIONS_SCIENTIFIQUES.map((n) => humaine(n, "evolution", "sciences")),
  ...MANAGEMENT_XXE.map((n) => humaine(n, "social", "management")),
  ...MANAGEMENT_XXIE.map((n) => humaine(n, "social", "management")),
];

// Quelques fiches humaines documentées en priorité (format de fiche prouvé, cf. questions-tests section 7.3)
const DOCUMENTEES_HUMAINES = {
  "friedrich-nietzsche": {
    these_centrale: "La morale traditionnelle (en particulier chrétienne) est une construction historique de ressentiment ; l'affirmation de la vie passe par la volonté de puissance et la création de valeurs nouvelles (« devenir ce que l'on est »).",
    apport: "Critique généalogique de la morale, analyse du nihilisme européen, pensée de l'affirmation face au pessimisme.",
    limites_critiques: "Style aphoristique difficile à systématiser ; instrumentalisé historiquement (déformations idéologiques du XXe siècle) ; absence de programme politique positif clair.",
    resonance_ia: "Aucune IA actuelle ne « veut » ou n'affirme au sens nietzschéen — la volonté de puissance suppose une intentionnalité vécue que les LLM n'ont pas (cf. débat qualia, référentiel B5).",
    sources: [{ titre: "Ainsi parlait Zarathoustra", type: "primaire" }, { titre: "Généalogie de la morale", type: "primaire" }],
    statut: "documente",
  },
  "aristote": undefined, // Aristote n'est pas dans la liste fournie par Julien — ajouté ci-dessous séparément si besoin.
};

for (const [id, data] of Object.entries(DOCUMENTEES_HUMAINES)) {
  if (!data) continue;
  const idx = fichesHumaines.findIndex((f) => f.id === id);
  if (idx >= 0) fichesHumaines[idx] = { ...fichesHumaines[idx], ...data };
}

// Fiches IA — familles génératives prioritaires (Claude/Cowork, Codex, DeepSeek) documentées
const fichesIA = [
  ia("Claude (Anthropic) / Cowork", "generatif_raisonnement", {
    editeur: "Anthropic",
    capacites_cles: [
      "Raisonnement et rédaction en langage naturel multi-tour",
      "Usage agentique d'outils (fichiers, shell, navigateur, MCP)",
      "Orchestration de tâches longues avec mémoire de session",
      "Mode Cowork : automatisation de tâches bureautiques/fichiers pour un utilisateur non-développeur",
    ],
    usages: [
      { secteur: "education", description: "Tutorat et génération de contenu pédagogique différencié", trl: 7, exemples: [], sources: [] },
      { secteur: "recherche", description: "Revue de littérature assistée, synthèse de corpus documentaires", trl: 6, exemples: [], sources: [] },
    ],
    limites_connues: "Hallucination possible sur faits de niche ; pas de mémoire persistante native hors mécanismes dédiés ; dépendance à la qualité du prompt/contexte fourni.",
    sources: [{ titre: "Documentation Anthropic", url: "https://docs.claude.com", type: "primaire" }],
    statut: "documente",
  }),
  ia("Codex / famille GPT", "generatif_raisonnement", {
    editeur: "OpenAI",
    capacites_cles: [
      "Génération et complétion de code multi-langage",
      "Raisonnement et rédaction en langage naturel",
      "Agents de codage autonomes (exécution, tests, itération)",
    ],
    usages: [
      { secteur: "industrie", description: "Automatisation de tâches de développement logiciel", trl: 7, exemples: [], sources: [] },
    ],
    limites_connues: "Hallucination de code plausible mais incorrect ; dépendance à la qualité des specs fournies.",
    sources: [{ titre: "Documentation OpenAI", url: "https://platform.openai.com/docs", type: "primaire" }],
    statut: "documente",
  }),
  ia("DeepSeek", "generatif_raisonnement", {
    editeur: "DeepSeek (Chine)",
    capacites_cles: [
      "Modèles de raisonnement en chaîne de pensée (chain-of-thought) entraînés à coût réduit",
      "Modèles ouverts (poids publiés) compétitifs sur benchmarks de raisonnement et de code",
    ],
    usages: [],
    limites_connues: "À documenter précisément (gouvernance des données, modération, conditions d'usage) — priorité de veille immédiate.",
    sources: [{ titre: "Publications techniques DeepSeek", type: "primaire" }],
    statut: "a_documenter",
  }),
  ...ARCHITECTURES_CELEBRES.map((n) => ia(n, "generatif_raisonnement")),
  ...MODELES_CLASSIQUES.map((n) => ia(n, "predictif_data_science")),
  ...DEEP_LEARNING.map((n) => ia(n, "predictif_data_science")),
];

mkdirSync("data/seed", { recursive: true });

const fichesHumainesFinales = mergeAvecExistant(fichesHumaines, "data/seed/fiches_humaines.json");
const fichesIAFinales = mergeAvecExistant(fichesIA, "data/seed/fiches_ia.json");

writeFileSync("data/seed/fiches_humaines.json", JSON.stringify(fichesHumainesFinales, null, 2));
writeFileSync("data/seed/fiches_ia.json", JSON.stringify(fichesIAFinales, null, 2));

console.log(`fiches_humaines: ${fichesHumainesFinales.length} entrées`);
console.log(`fiches_ia: ${fichesIAFinales.length} entrées`);
console.log(`documentées (humaines): ${fichesHumainesFinales.filter(f=>f.statut==="documente").length}`);
console.log(`documentées (ia): ${fichesIAFinales.filter(f=>f.statut==="documente").length}`);
console.log(`documentées (IA): ${fichesIA.filter(f=>f.statut==="documente").length}`);
