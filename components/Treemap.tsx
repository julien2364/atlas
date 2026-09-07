"use client";

// Treemap SVG minimaliste (algorithme "squarified", Bruls et al. 1999) — pas de
// dépendance externe, pour rester léger et éviter d'ajouter une librairie de
// graphes juste pour ce composant. Cf. mégaprompt section 8 : "treemap par domaine".

export interface TreemapItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Rect {
  item: TreemapItem;
  x: number;
  y: number;
  w: number;
  h: number;
}

function worst(row: TreemapItem[], length: number, total: number): number {
  if (row.length === 0) return Infinity;
  const sum = row.reduce((s, i) => s + i.value, 0);
  const areaScale = (length * length) / total;
  let max = -Infinity;
  let min = Infinity;
  for (const it of row) {
    const area = it.value * areaScale;
    max = Math.max(max, area);
    min = Math.min(min, area);
  }
  const sideScale = sum * sum * areaScale;
  return Math.max((length * length * max) / (sideScale || 1), (sideScale || 1) / (length * length * min));
}

function layoutRow(row: TreemapItem[], x: number, y: number, w: number, h: number, total: number, vertical: boolean): Rect[] {
  const sum = row.reduce((s, i) => s + i.value, 0);
  const rects: Rect[] = [];
  let offset = 0;
  const thickness = vertical ? (sum / total) * w : (sum / total) * h;
  for (const it of row) {
    const share = sum > 0 ? it.value / sum : 0;
    if (vertical) {
      const rh = share * h;
      rects.push({ item: it, x, y: y + offset, w: thickness, h: rh });
      offset += rh;
    } else {
      const rw = share * w;
      rects.push({ item: it, x: x + offset, y, w: rw, h: thickness });
      offset += rw;
    }
  }
  return rects;
}

function squarify(items: TreemapItem[], x: number, y: number, w: number, h: number, total: number): Rect[] {
  if (items.length === 0) return [];
  const vertical = w < h;
  const length = vertical ? h : w;
  let row: TreemapItem[] = [];
  let rest = [...items];
  let bestWorst = Infinity;

  while (rest.length > 0) {
    const candidate = [...row, rest[0]];
    const w2 = worst(candidate, length, total);
    if (w2 <= bestWorst || row.length === 0) {
      row = candidate;
      rest = rest.slice(1);
      bestWorst = w2;
    } else {
      break;
    }
  }

  const rowRects = layoutRow(row, x, y, w, h, total, vertical);
  const rowSum = row.reduce((s, i) => s + i.value, 0);
  const rowThickness = vertical ? (rowSum / total) * w : (rowSum / total) * h;

  let remaining: Rect[] = [];
  if (rest.length > 0) {
    const remTotal = rest.reduce((s, i) => s + i.value, 0);
    if (vertical) {
      remaining = squarify(rest, x + rowThickness, y, w - rowThickness, h, remTotal);
    } else {
      remaining = squarify(rest, x, y + rowThickness, w, h - rowThickness, remTotal);
    }
  }

  return [...rowRects, ...remaining];
}

export default function Treemap({
  items,
  width = 640,
  height = 260,
  selected,
  onSelect,
  titreAccessible = "Treemap : surface proportionnelle au nombre de fiches par domaine",
}: {
  items: TreemapItem[];
  width?: number;
  height?: number;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  titreAccessible?: string;
}) {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((s, i) => s + i.value, 0);
  const rects = total > 0 ? squarify(positive, 0, 0, width, height, total) : [];

  // Convention d'accessibilité alignée sur HeatmapTRL / GrapheConnaissances :
  // chaque zone cliquable est activable au clavier (role="button" + tabIndex +
  // Entrée/Espace), porte un libellé explicite, et le contenu du dessin est
  // repris juste en dessous sous forme de boutons texte — un lecteur d'écran
  // ou une navigation au clavier n'a jamais besoin d'entrer dans le SVG.
  return (
    <div>
      <div className="defilement-h">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          className="block min-w-[20rem]"
          role="img"
          aria-label={`${titreAccessible}. ${positive
            .map((i) => `${i.label} : ${i.value}`)
            .join(", ")}. La même répartition est reprise en boutons texte sous le dessin.`}
        >
          {rects.map((r) => {
            const isSelected = selected === r.item.key;
            const dimmed = selected && !isSelected;
            const interactif = Boolean(onSelect);
            return (
              <g
                key={r.item.key}
                role={interactif ? "button" : undefined}
                tabIndex={interactif ? 0 : undefined}
                aria-pressed={interactif ? isSelected : undefined}
                aria-label={interactif ? `${r.item.label} : ${r.item.value} fiches. Lister les fiches.` : undefined}
                onClick={() => onSelect?.(isSelected ? null : r.item.key)}
                onKeyDown={(e) => {
                  if (!interactif) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(isSelected ? null : r.item.key);
                  }
                }}
                style={{ cursor: interactif ? "pointer" : "default" }}
              >
                <title>{`${r.item.label} — ${r.item.value} fiches`}</title>
                <rect
                  x={r.x}
                  y={r.y}
                  width={Math.max(r.w - 1.5, 0)}
                  height={Math.max(r.h - 1.5, 0)}
                  fill={r.item.color}
                  opacity={dimmed ? 0.3 : 1}
                  stroke={isSelected ? "var(--foreground)" : "none"}
                  strokeWidth={isSelected ? 2 : 0}
                  rx={3}
                />
                {r.w > 60 && r.h > 24 && (
                  <text
                    x={r.x + 6}
                    y={r.y + 16}
                    fontSize={11}
                    fill="#ffffff"
                    opacity={dimmed ? 0.6 : 1}
                    style={{ pointerEvents: "none" }}
                  >
                    {r.item.label} ({r.item.value})
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {onSelect && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
          {positive.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(selected === item.key ? null : item.key)}
              aria-pressed={selected === item.key}
              className={`inline-flex items-center gap-1.5 rounded hover:underline ${
                selected === item.key ? "font-semibold text-neutral-900 dark:text-neutral-100" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              {item.label} ({item.value})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
