/*
 * Parents Solo — Assistant « langage neutre » coparental (Chantier A, session n°2).
 *
 * Transformateur de texte 100 % à base de règles, côté navigateur, SANS aucun appel à une
 * API d'IA (décision explicite de Julien). Même esprit que MODERATION_CODE utilisé pour la
 * modération de la messagerie : une liste de motifs (regex) → un type de problème → une
 * explication courte → une proposition de reformulation.
 *
 * Usage :
 *   const r = window.ParentSoloNeutral.analyze(texte);
 *   r.issues   → [{ match, type, label, why, suggestion }]
 *   r.rewrite  → texte réécrit automatiquement (à relire par l'utilisateur, jamais envoyé seul)
 *   r.score    → 0 (neutre) … 100 (très conflictuel), purement indicatif
 *
 * Intégration prévue dans le widget de messagerie (build_messaging_widget.py), avant l'envoi
 * d'un message dans un canal coparental (x_parentsolo_direct_message) :
 *   const r = ParentSoloNeutral.analyze(text);
 *   if (r.issues.length) { afficher r.issues + r.rewrite ; boutons « Envoyer tel quel » /
 *   « Utiliser la reformulation » / « Modifier » } else { envoyer }
 *
 * Principe de reformulation (approche factuelle « je » : fait observable → ressenti/besoin →
 * demande concrète). Aucun jugement sur l'autre parent, aucune généralisation.
 * Ce module ne stocke rien et ne transmet rien : tout reste dans le navigateur.
 */
(function () {
  "use strict";

  // Chaque règle : re (regex), type, label, why, fix (fonction(match, groupes…) → chaîne),
  // weight (contribution au score indicatif).
  const RULES = [
    {
      type: "generalisation", label: "Généralisation (« toujours / jamais »)",
      re: /\btu (?:ne |n')?([\p{L}']+) (toujours|jamais)\b([^.!?]*)/giu,
      why: "« Toujours » et « jamais » transforment un fait ponctuel en reproche global, ce qui pousse l'autre à se défendre plutôt qu'à répondre.",
      fix: (m, verb, adv, rest) => `j'ai constaté que${rest ? rest : " cela"} ${adv.toLowerCase() === "jamais" ? "n'a pas été fait" : "s'est reproduit"} (préciser la date)`,
      weight: 15,
    },
    {
      type: "generalisation", label: "Généralisation (« comme d'habitude / encore une fois »)",
      re: /\b(comme d'habitude|comme toujours|encore une fois|une fois de plus|évidemment|bien sûr que non)\b/gi,
      why: "Ces formules sous-entendent une répétition et un jugement ; elles n'apportent aucune information utile à l'organisation.",
      fix: () => "",
      weight: 10,
    },
    {
      type: "accusation", label: "Accusation directe (« c'est de ta faute »)",
      re: /\b(?:c'est (?:de )?ta faute|à cause de toi|par ta faute|tu es responsable de)\b\s*(?:si|que|de)?([^.!?,]*)/giu,
      why: "Attribuer une faute ferme la discussion. Décrire la conséquence concrète permet de chercher une solution.",
      fix: (m, rest) => `la conséquence a été :${rest && rest.trim() ? " " + rest.trim() : " (décrire)"}`,
      weight: 20,
    },
    {
      type: "jugement", label: "Jugement sur la personne",
      re: /\btu (?:es|n'es qu'|n'es pas|as toujours été|seras toujours) (?:un |une |vraiment |complètement |totalement )?(?:nul(?:le)?|irresponsable|égoïste|incapable|menteu(?:r|se)|lâche|immature|inutile|pathétique|minable|malhonnête|toxique|manipulat(?:eur|rice)|mauvais(?:e)? (?:père|mère|parent))\b/gi,
      why: "Qualifier la personne (au lieu de décrire un acte) est perçu comme une attaque et peut être retenu contre vous en cas de médiation ou de procédure.",
      fix: () => "j'ai été affecté·e par (décrire l'acte précis)",
      weight: 25,
    },
    {
      type: "jugement", label: "Insulte ou grossièreté",
      re: /\b(connard|connasse|con|conne|salaud|salope|abruti(?:e)?|débile|crétin(?:e)?|imbécile|idiot(?:e)?|pauvre type|merde|putain|bordel)\b/gi,
      why: "Les insultes disqualifient le message entier, quel que soit son fond.",
      fix: () => "",
      weight: 30,
    },
    {
      type: "intention", label: "Procès d'intention (« tu t'en fiches », « tu fais exprès »)",
      re: /\b(tu t'en (?:fiches|fous|moques)|tu (?:le )?fais exprès|tu ne penses qu'à toi|tu n'en as rien à faire|tu te moques de|tu cherches à me|tu veux me)\b/gi,
      why: "Prêter une intention à l'autre parent revient à parler à sa place. Restez sur ce qui est observable.",
      fix: () => "j'ai l'impression que ce point n'est pas prioritaire pour toi ; pour moi il est important parce que",
      weight: 20,
    },
    {
      type: "injonction", label: "Ordre / exigence",
      re: /\b(je t'interdis|j'exige|tu dois|il faut que tu|tu as intérêt à|t'as intérêt à|je te préviens|je t'oblige)\b/gi,
      why: "Une exigence appelle un refus. Une demande précise avec une échéance obtient plus souvent une réponse.",
      fix: () => "je te demande de",
      weight: 15,
    },
    {
      type: "menace", label: "Menace ou chantage",
      re: /\b(?:sinon (?:je|tu)|je vais (?:te|t')\s?(?:faire|montrer|apprendre)|tu vas (?:le )?regretter|tu ne (?:re)?verras (?:plus|pas)|je (?:ne )?te laisserai (?:pas|plus)|mon avocat|je porte plainte)\b[^.!?]*/giu,
      why: "Les menaces (y compris sur le droit de visite) sont contre-productives et peuvent être utilisées contre vous ; si un point juridique doit être réglé, il vaut mieux l'écrire séparément et factuellement.",
      fix: () => "si nous ne trouvons pas d'accord, je propose de passer par un médiateur familial",
      weight: 30,
    },
    {
      type: "ton", label: "Cri écrit (majuscules)",
      re: /\b[A-ZÀ-Ü]{5,}(?:\s+[A-ZÀ-Ü]{2,})*\b/g,
      why: "Les majuscules sont lues comme des cris.",
      fix: (m) => m.charAt(0) + m.slice(1).toLowerCase(),
      weight: 8,
    },
    {
      type: "ton", label: "Ponctuation agressive (!!!, ???)",
      re: /([!?])\1{1,}/g,
      why: "La ponctuation répétée exprime l'exaspération, pas l'information.",
      fix: (m, p) => p,
      weight: 5,
    },
    {
      type: "enfant", label: "L'enfant pris à témoin ou instrumentalisé",
      re: /[^.!?]*\b(?:m'a dit que tu|m'ont dit que tu|préfère(?:nt)? (?:être )?(?:avec moi|chez moi)|ne veu(?:t|lent) (?:pas|plus) (?:aller|venir) chez toi|pleure(?:nt)? quand)\b[^.!?]*/giu,
      why: "Rapporter les propos de l'enfant contre l'autre parent le place au centre du conflit. Parlez de vos observations à vous, et proposez d'en discuter sans l'enfant.",
      fix: () => "j'ai observé (décrire le comportement), je souhaiterais que nous en parlions entre adultes",
      weight: 20,
    },
    {
      type: "passe", label: "Référence au passé du couple",
      re: /\b(comme quand on était ensemble|depuis (?:notre |la )?séparation tu|pendant (?:notre )?mariage|tu m'as (?:quitté|trompé|abandonné)e?|tu as toujours été comme ça)\b/gi,
      why: "Le passé du couple n'aide pas l'organisation présente de l'enfant. Concentrez le message sur le point à régler.",
      fix: () => "",
      weight: 15,
    },
  ];

  // Nettoyage de fin : espaces doubles, espaces avant ponctuation, majuscule initiale.
  function tidy(s) {
    return s
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/,\s*([.!?])/g, "$1")
      .replace(/([.!?])\s*[.!?]+/g, "$1")
      .replace(/([.!?])(?=[^\s.!?)\d])/g, "$1 ")
      .replace(/(^|[.!?]\s+)([a-zà-ü])/g, (m, a, c) => a + c.toUpperCase())
      .replace(/\(\s+/g, "(")
      .replace(/^\s+|\s+$/g, "")
      .replace(/^([a-zà-ü])/, (c) => c.toUpperCase());
  }

  function analyze(text) {
    const src = String(text || "");
    const issues = [];
    let rewrite = src;
    let score = 0;

    RULES.forEach((rule) => {
      const re = new RegExp(rule.re.source, rule.re.flags);
      let m;
      while ((m = re.exec(src)) !== null) {
        const suggestion = typeof rule.fix === "function" ? rule.fix.apply(null, m) : rule.fix;
        issues.push({ match: m[0], type: rule.type, label: rule.label, why: rule.why, suggestion: suggestion });
        score += rule.weight;
        if (m[0].length === 0) re.lastIndex++;
      }
      rewrite = rewrite.replace(new RegExp(rule.re.source, rule.re.flags), function () {
        return typeof rule.fix === "function" ? rule.fix.apply(null, arguments) : rule.fix;
      });
    });

    // Quand un problème a été trouvé, on termine par une demande concrète si le texte n'en a pas.
    if (issues.length && !/\bje (?:te )?(?:propose|demande|souhaite)/i.test(rewrite)) {
      rewrite = rewrite.replace(/[.!?]?\s*$/, "") + ". Je te propose que nous convenions d'une solution : (préciser la demande et une date).";
    }

    return {
      score: Math.min(100, score),
      issues: issues,
      rewrite: issues.length ? tidy(rewrite) : src,
      neutral: issues.length === 0,
    };
  }

  // Modèle de message neutre pour partir d'une page blanche (fait → conséquence → demande).
  const TEMPLATE =
    "Bonjour,\n" +
    "Fait : (ce qui s'est passé, avec la date, sans qualificatif)\n" +
    "Conséquence pour l'enfant / pour l'organisation : (concret)\n" +
    "Demande : (une action précise, une échéance)\n" +
    "Merci de me confirmer d'ici le (date).";

  window.ParentSoloNeutral = { analyze: analyze, RULES: RULES, TEMPLATE: TEMPLATE, version: "1.0" };
})();
