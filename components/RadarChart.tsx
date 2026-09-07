"use client";

// Radar SVG minimaliste, sans dépendance externe. Cf. mégaprompt section 8 :
// "radar de maturité IA vs. humain". Utilisé ici pour le TRL (Technology
// Readiness Level, 1-9) moyen par secteur d'usage — seule métrique de
// maturité réellement renseignée à ce stade dans les fiches IA documentées
// (UsageSectoriel.trl). Un secteur sans aucune fiche documentée n'apparaît
// pas, pour ne pas afficher une valeur inventée.

export interface RadarAxisDatum {
  key: string;
  label: string;
  value: number; // 0..max
  count: number; // nombre de points ayant permis le calcul (transparence)
}

export default function RadarChart({
  data,
  max = 9,
  size = 320,
}: {
  data: RadarAxisDatum[];
  max?: number;
  size?: number;
}) {
  const center = size / 2;
  const radius = size / 2 - 48;
  const n = data.length;

  if (n < 3) {
    return (
      <p className="text-xs text-neutral-500">
        Pas assez de secteurs avec des données réelles de TRL pour tracer un radar (minimum 3, {n} disponible
        {n > 1 ? "s" : ""} actuellement).
      </p>
    );
  }

  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointFor = (i: number, value: number) => {
    const r = (value / max) * radius;
    const a = angleFor(i);
    return { x: center + r * Math.cos(a), y: center + r * Math.sin(a) };
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const polygonPoints = data.map((d, i) => pointFor(i, d.value));
  const polygonStr = polygonPoints.map((p) => `${p.x},${p.y}`).join(" ");

  const resume = data.map((d) => `${d.label} : ${d.value.toFixed(1)} sur ${max} (n=${d.count})`).join(", ");

  return (
    <div>
      <div className="defilement-h">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          height={size}
          className="block min-w-[18rem]"
          role="img"
          aria-label={`Radar de maturité TRL moyenne par secteur d'usage, échelle de 1 à ${max}. ${resume}. Les mêmes valeurs sont listées sous le graphique.`}
        >
          {rings.map((r) => {
            const ringPoints = data.map((_, i) => pointFor(i, max * r));
            return (
              <polygon
                key={r}
                points={ringPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.15}
              />
            );
          })}
          {data.map((_, i) => {
            const p = pointFor(i, max);
            return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="currentColor" strokeOpacity={0.15} />;
          })}
          <polygon points={polygonStr} fill="rgb(99 102 241 / 0.35)" stroke="rgb(99 102 241)" strokeWidth={2} />
          {polygonPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill="rgb(99 102 241)" />
          ))}
          {data.map((d, i) => {
            const labelPoint = pointFor(i, max * 1.18);
            return (
              <text
                key={d.key}
                x={labelPoint.x}
                y={labelPoint.y}
                fontSize={11}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="currentColor"
              >
                {d.label} ({d.value.toFixed(1)}, n={d.count})
              </text>
            );
          })}
        </svg>
      </div>

      {/* Équivalent textuel : le dessin est un résumé, la liste est la donnée.
          Même convention que le graphe de connaissances et les heatmaps. */}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        {data.map((d) => (
          <li key={d.key}>
            <span className="text-neutral-700 dark:text-neutral-300">{d.label}</span> — TRL moyen{" "}
            <span className="tabular-nums">{d.value.toFixed(1)}</span>/{max} (sur {d.count} usage
            {d.count > 1 ? "s" : ""} documenté{d.count > 1 ? "s" : ""})
          </li>
        ))}
      </ul>
    </div>
  );
}
