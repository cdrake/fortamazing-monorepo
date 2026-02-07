// src/screens/HikeDetail.tsx
import React, { JSX, useEffect, useState } from "react"
import {
  View,
  Text as RNText,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native"
import { RouteProp, useNavigation, useRoute, NavigationProp } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import DaySelector from "@/components/DaySelector"
import HikeMap from "@/components/HikeMap"
import ImageUploadButton from "@/components/ImageUploadButton"
import TrackStatsBar from "@/components/TrackStatsBar"
import { auth as firebaseAuth } from "@/config/firebase"
import type { LatLng } from "@/lib/geoUtils"
import { getHike } from "@/lib/hikes"
import { listImagesForHike } from "@/lib/images"
import { loadHikeTrackData, type DayTrack, type HikeTrackData } from "@/lib/trackData"
import { useAppTheme } from "@/theme/context"

type RouteParams = {
  HikeDetail: { hikeId: string }
  Home: undefined
}
type NavigationType = NavigationProp<RouteParams>

export default function HikeDetail(): JSX.Element {
  const route = useRoute<RouteProp<RouteParams, "HikeDetail">>()
  const { hikeId } = route.params
  const { themed } = useAppTheme()
  const insets = useSafeAreaInsets()

  const [hike, setHike] = useState<any | null>(null)
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigation = useNavigation<NavigationType>()

  // Track state
  const [dayTracks, setDayTracks] = useState<DayTrack[]>([])
  const [allCoordinates, setAllCoordinates] = useState<LatLng[]>([])
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    console.log("[HikeDetail] loading hike and images for hikeId:", hikeId)
    try {
      const h = await getHike(hikeId)
      console.log("[HikeDetail] getHike returned:", h)
      setHike(h)

      // Load track data (non-blocking — screen still renders if this fails)
      if (h) {
        try {
          const trackData: HikeTrackData = await loadHikeTrackData(h as Record<string, unknown>)
          setDayTracks(trackData.dayTracks)
          setAllCoordinates(trackData.allCoordinates)
        } catch (trackErr) {
          console.warn("[HikeDetail] track data load failed:", trackErr)
        }
      }

      // fallback to currently authenticated user
      const currentUserUid = firebaseAuth?.currentUser?.uid ?? undefined

      // pass ownerUid explicitly to ensure correct path is used by images helper
      const imgs = await listImagesForHike(hikeId, currentUserUid)
      console.log("[HikeDetail] listImagesForHike returned", imgs?.length ?? 0, "images")
      setImages(imgs)
    } catch (err: any) {
      // Log full error details (FirebaseError properties are helpful)
      console.warn("[HikeDetail] load error", err)
      if (err?.code) console.warn("[HikeDetail] firebase error code:", err.code)
      if (err?.customData) console.warn("[HikeDetail] firebase customData:", err.customData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [hikeId])

  function handleDayPress(index: number) {
    setActiveDayIndex((prev) => (prev === index ? null : index))
  }

  if (loading) return <ActivityIndicator style={themed({ flex: 1 })} />

  // absolute button styles so it's always on top & tappable
  const backBtnStyle = {
    position: "absolute" as const,
    top: (insets.top ?? 0) + 8,
    left: 8,
    zIndex: 2000,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    // subtle background so it remains visible on varied content
    backgroundColor: "rgba(255,255,255,0.85)",
    // Android elevation
    ...(Platform.OS === "android" ? { elevation: 6 } : {}),
  }

  return (
    <View style={themed({ flex: 1 })}>
      {/* floating home/back button (above all other content) */}
      <TouchableOpacity
        onPress={() => {
          try {
            if (navigation.canGoBack()) navigation.goBack()
            else navigation.navigate("Home" as any)
          } catch {
            navigation.navigate("Home" as any)
          }
        }}
        // bigger touch area to counter overlapping UI
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.8}
        style={backBtnStyle}
        accessibilityRole="button"
        accessibilityLabel="Go home"
      >
        <RNText style={themed({ fontSize: 16 })}>← Home</RNText>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={themed({ padding: 16, paddingTop: (insets.top ?? 0) + 56 })}
      >
        <RNText style={themed({ fontSize: 20, fontWeight: "700", marginBottom: 8 })}>
          {hike?.title ?? "Untitled"}
        </RNText>
        <RNText style={themed({ marginBottom: 12 })}>{hike?.description ?? ""}</RNText>

        {/* Map and track visualization */}
        {dayTracks.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <HikeMap
              dayTracks={dayTracks}
              activeDayIndex={activeDayIndex}
              allCoordinates={allCoordinates}
              onDayPress={handleDayPress}
            />
            <DaySelector
              dayTracks={dayTracks}
              activeDayIndex={activeDayIndex}
              onDayPress={handleDayPress}
            />
            <TrackStatsBar dayTracks={dayTracks} activeDayIndex={activeDayIndex} />
          </View>
        )}

        <ImageUploadButton
          hikeId={hikeId}
          onUploadComplete={() => {
            void load()
          }}
        />

        <RNText style={themed({ marginTop: 16, marginBottom: 8, fontWeight: "600" })}>
          Photos
        </RNText>

        {images.length === 0 ? (
          <RNText>No photos yet</RNText>
        ) : (
          images.map((img) => (
            <Image
              key={img.id}
              source={{ uri: img.url }}
              style={themed({ width: "100%", height: 220, marginBottom: 12, borderRadius: 8 })}
            />
          ))
        )}
      </ScrollView>
    </View>
  )
}
