import React, { useMemo } from "react";
import type { FC } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export interface ElevationProfileProps {
  /** Array of { dist_m, elev } points along the track */
  profile: { dist_m: number; elev: number }[];
  title?: string;
}

/** Downsample to at most `maxPoints` for rendering performance */
function downsample(profile: { dist_m: number; elev: number }[], maxPoints = 300) {
  if (profile.length <= maxPoints) return profile;
  const step = profile.length / maxPoints;
  const result: { dist_m: number; elev: number }[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(profile[Math.floor(i * step)]);
  }
  // always include the last point
  result.push(profile[profile.length - 1]);
  return result;
}

const ElevationProfileInner: FC<ElevationProfileProps> = ({ profile, title = "Elevation profile" }) => {
  const data = useMemo(() => {
    if (!profile || profile.length === 0) return [];
    const sampled = downsample(profile);
    return sampled.map((p) => ({
      dist_km: +(p.dist_m / 1000).toFixed(2),
      elev_m: Math.round(p.elev),
    }));
  }, [profile]);

  if (!profile || profile.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No elevation data available</div>;
  }

  const elevs = data.map((d) => d.elev_m);
  const minElev = Math.min(...elevs);
  const maxElev = Math.max(...elevs);
  const pad = Math.max(10, (maxElev - minElev) * 0.1);

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="p-2">
        <div className="text-sm font-medium mb-2">{title}</div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="dist_km"
                tick={{ fontSize: 10 }}
                label={{ value: "km", position: "insideBottomRight", offset: -5, fontSize: 10 }}
              />
              <YAxis
                domain={[Math.floor(minElev - pad), Math.ceil(maxElev + pad)]}
                tick={{ fontSize: 10 }}
                label={{ value: "m", position: "insideTopLeft", offset: -5, fontSize: 10 }}
              />
              <Tooltip
                formatter={(value: number) => [`${value} m`, "Elevation"]}
                labelFormatter={(label: number) => `${label} km`}
              />
              <Area
                type="monotone"
                dataKey="elev_m"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                fill="url(#elevGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const ElevationProfile = React.memo(ElevationProfileInner) as typeof ElevationProfileInner;

export default ElevationProfile;
