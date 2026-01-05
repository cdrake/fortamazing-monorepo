import React, { useMemo } from "react";
import type { FC } from "react";
import { Card, CardContent } from "@/components/ui/card"; // optional shadcn card
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export interface ElevationHistogramProps {
  elevations: number[];
  bins?: number;
  title?: string;
}

type HistogramBin = {
  bin: string;
  count: number;
  mid: number;
};

function computeHistogram(elevations: number[], bins = 30): HistogramBin[] {
  if (!elevations || elevations.length === 0) return [];
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = max - min || 1;
  const binSize = range / bins;
  const counts = new Array<number>(bins).fill(0);

  for (const v of elevations) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / binSize)));
    counts[idx]++;
  }

  const data: HistogramBin[] = counts.map((count, i) => {
    const from = min + i * binSize;
    const to = from + binSize;
    return {
      bin: `${Math.round(from)}–${Math.round(to)}`,
      count,
      mid: Math.round((from + to) / 2),
    };
  });

  return data;
}

const ElevationHistogramInner: FC<ElevationHistogramProps> = ({ elevations, bins = 30, title = "Elevation histogram" }) => {
  const data = useMemo(() => computeHistogram(elevations, bins), [elevations, bins]);

  if (!elevations || elevations.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No elevation data available</div>;
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
              <Tooltip />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const ElevationHistogram = React.memo(ElevationHistogramInner) as typeof ElevationHistogramInner;

export default ElevationHistogram;
