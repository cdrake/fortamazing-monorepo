import { View } from "react-native"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

type ProfilePoint = { dist_m: number; elev: number }

interface ElevationProfileProps {
  profile: ProfilePoint[]
  height?: number
}

/**
 * Lightweight elevation profile chart using View bars.
 * No SVG dependency required.
 */
export default function ElevationProfile({ profile, height = 120 }: ElevationProfileProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  if (!profile || profile.length < 2) return null

  const elevs = profile.map((p) => p.elev)
  const minElev = Math.min(...elevs)
  const maxElev = Math.max(...elevs)
  const range = maxElev - minElev || 1
  const totalDist = profile[profile.length - 1].dist_m

  // Downsample to ~80 bars max
  const maxBars = 80
  const step = Math.max(1, Math.floor(profile.length / maxBars))
  const sampled: ProfilePoint[] = []
  for (let i = 0; i < profile.length; i += step) {
    sampled.push(profile[i])
  }

  return (
    <View style={{ marginTop: 8 }}>
      <Text weight="semiBold" style={themed({ fontSize: 13, marginBottom: 4 })}>
        Elevation Profile
      </Text>
      <View
        style={{
          height,
          flexDirection: "row",
          alignItems: "flex-end",
          backgroundColor: colors.palette.neutral200,
          borderRadius: 8,
          overflow: "hidden",
          paddingHorizontal: 2,
        }}
      >
        {sampled.map((p, i) => {
          const barHeight = ((p.elev - minElev) / range) * (height - 16) + 4
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: barHeight,
                backgroundColor: colors.tint,
                marginHorizontal: 0.5,
                borderTopLeftRadius: 1,
                borderTopRightRadius: 1,
                opacity: 0.7,
              }}
            />
          )
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={themed({ fontSize: 10, color: colors.textDim })}>
          {Math.round(minElev)} m
        </Text>
        <Text style={themed({ fontSize: 10, color: colors.textDim })}>
          {(totalDist / 1000).toFixed(1)} km
        </Text>
        <Text style={themed({ fontSize: 10, color: colors.textDim })}>
          {Math.round(maxElev)} m
        </Text>
      </View>
    </View>
  )
}
