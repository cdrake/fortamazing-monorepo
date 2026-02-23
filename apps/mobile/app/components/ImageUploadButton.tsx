import { useState } from "react"
import { View, ActivityIndicator } from "react-native"
import * as ImagePicker from "expo-image-picker"

import { Button } from "@/components/Button"
import { addImageMeta, parseExifGps } from "@/lib/images"
import { uploadImageFromUri } from "@/lib/storage"
import { useAppTheme } from "@/theme/context"

type ImageUploadButtonProps = {
  hikeId: string
  onUploadComplete?: () => void
}

export default function ImageUploadButton({ hikeId, onUploadComplete }: ImageUploadButtonProps) {
  const [loading, setLoading] = useState(false)
  const { themed } = useAppTheme()

  async function pickAndUpload() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        exif: true,
      })

      // User canceled picker
      if (result.canceled) return

      // Grab first selected asset
      const asset = result.assets?.[0]
      if (!asset?.uri) return

      setLoading(true)

      const filename = asset.fileName ?? asset.uri.split("/").pop() ?? `photo-${Date.now()}.jpg`

      const remotePath = `hikes/${hikeId}/images/${Date.now()}_${filename}`

      // Upload to Firebase Storage
      const url = await uploadImageFromUri(asset.uri, remotePath)

      // Extract GPS and date from EXIF if available
      const exif = asset.exif
      const gps = exif ? parseExifGps(exif) : null
      const takenAt = exif?.DateTimeOriginal ? String(exif.DateTimeOriginal) : undefined

      // Save metadata in Firestore
      await addImageMeta(hikeId, {
        url,
        filename,
        path: remotePath,
        ...(gps ? { lat: gps.lat, lon: gps.lon } : {}),
        ...(takenAt ? { takenAt } : {}),
        ...(asset.width && asset.height
          ? { meta: { width: asset.width, height: asset.height } }
          : {}),
      })

      onUploadComplete?.()
    } catch (error) {
      console.warn("Image upload failed", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={themed({ marginTop: 12 })}>
      {loading ? <ActivityIndicator /> : <Button text="Upload Photo" onPress={pickAndUpload} />}
    </View>
  )
}
