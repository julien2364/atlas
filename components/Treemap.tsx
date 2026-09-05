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
}: {
  items: TreemapItem[];
  width?: number;
  height?: number;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((s, i) => s + i.value, 0);
  const rects = total > 0 ? squarify(positive, 0, 0, width, height, total) : [];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Treemap par domaine">
      {rects.map((r) => {
        const isSelected = selected === r.item.key;
        const dimmed = selected && !isSelected;
        return (
          <g
            key={r.item.key}
            onClick={() => onSelect?.(isSelected ? null : r.item.key)}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            <rect
              x={r.x}
              y={r.y}
              width={Math.max(r.w - 1.5, 0)}
              height={Math.max(r.h - 1.5, 0)}
              fill={r.item.color}
              opacity={dimmed ? 0.3 : 1}
              rx={3}
            />
            {r.w > 60 && r.h > 24 && (
              <text
                x={r.x + 6}
                y={r.y + 16}
                fontSize={11}
                fill="white"
                opacity={dimmed ? 0.5 : 1}
                style={{ pointerEvents: "none" }}
              >
                {r.item.label} ({r.item.value})
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
