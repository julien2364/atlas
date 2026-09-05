import { readFileSync } from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";

export const metadata = {
  title: "Mégaprompt — Atlas Humain × IA",
};

export default function MegapromptPage() {
  const filePath = path.join(process.cwd(), "docs", "megaprompt.md");
  const content = readFileSync(filePath, "utf-8");

  return (
    <div className="prose prose-neutral max-w-3xl space-y-4 text-sm dark:prose-invert">
      <p>
        <a href="/methodologie" className="underline">
          ← Retour à la méthodologie
        </a>
      </p>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
