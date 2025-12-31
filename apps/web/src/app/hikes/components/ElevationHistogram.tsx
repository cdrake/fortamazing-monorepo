import React, { useMemo } from "react";
import type { FC } from "react";
import { Card, CardContent } from "@/components/ui/card"; // optional shadcn card
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Props: elevations in meters (number[]). Optionally a title and number of bins.
export interface ElevationHistogramProps {
  elevations: number[];
  bins?: number;
  title?: string;
}

function computeHistogram(elevations: number[], bins = 30) {
  if (!elevations || elevations.length === 0) return [];
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = max - min || 1;
  const binSize = range / bins;
  const counts = new Array(bins).fill(0);

  for (const v of elevations) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / binSize)));
    counts[idx]++;
  }

  const data = counts.map((count, i) => {
    const from = min + i * binSize;
    const to = from + binSize;
    return {
      bin: `${Math.round(from)}–${Math.round(to)}`,
      count,
      // for compact x-axis, provide mid value
      mid: Math.round((from + to) / 2),
    };
  });

  return data;
}

const ElevationHistogram: FC<ElevationHistogramProps> = ({ elevations, bins = 30, title = "Elevation histogram" }) => {
  const data = useMemo(() => computeHistogram(elevations, bins), [elevations, bins]);

  if (!elevations || elevations.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">No elevation data available</div>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="p-2">
        <div className="text-sm font-medium mb-2">{title}</div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
              <XAxis dataKey="mid" interval="preserveEnd" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value: any, name: any) => [value, name]} />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ElevationHistogram;

/*
Usage example (Map component):

// state
const [selectedElevations, setSelectedElevations] = useState<number[] | null>(null);

// when creating each polyline for a track segment:
<Polyline
  positions={latlngs}
  eventHandlers={{
    click: () => {
      // extract elevations from segment: assume each point is [lon, lat, ele]
      const elevations = latlngs.map((p: any) => (Array.isArray(p) ? p[2] ?? 0 : p.alt ?? 0));
      setSelectedElevations(elevations);
    },
  }}
/>

// and render the histogram (inline panel or modal)
{selectedElevations && (
  <div className="fixed right-4 bottom-4 z-50">
    <ElevationHistogram elevations={selectedElevations} bins={40} title="Segment elevation" />
    <button className="block mt-2 text-xs underline" onClick={() => setSelectedElevations(null)}>
      Close
    </button>
  </div>
)}

Notes:
- This component expects raw elevation numbers in meters. If your GPX/KML points store elevation in feet convert them first.
- If your points are objects (e.g. {lat,lng,ele}) adapt the extractor accordingly.
- For mobile consider showing the histogram in a bottom sheet/modal. For desktop a small fixed panel works well.
*/
