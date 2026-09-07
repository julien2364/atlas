import { readFileSync } from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";

export const metadata = {
  title: "Mégaprompt — spécification du projet",
  description:
    "La spécification maîtresse d'ATLAS Humain × IA, telle qu'elle est versionnée dans le dépôt : mission, référentiels, méthodologie, plan de production.",
  alternates: { canonical: "/megaprompt" },
};

export default function MegapromptPage() {
  const filePath = path.join(process.cwd(), "docs", "megaprompt.md");
  const content = readFileSync(filePath, "utf-8");

  return (
    <div className="max-w-3xl text-sm">
      <p className="mb-6">
        <a href="/methodologie" className="underline">
          ← Retour à la méthodologie
        </a>
      </p>
      {/* Rendu du Markdown : cf. .contenu-md dans app/globals.css — le projet
          n'embarque pas @tailwindcss/typography, les classes `prose` utilisées
          ici auparavant n'avaient aucun effet. */}
      <div className="contenu-md text-neutral-700 dark:text-neutral-300">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
