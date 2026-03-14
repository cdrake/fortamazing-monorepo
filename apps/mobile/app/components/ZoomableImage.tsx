import { useState } from "react"
import { Image, TouchableOpacity } from "react-native"
import ImageViewing from "react-native-image-viewing"

interface ZoomableImageProps {
  uri: string
  thumbnailStyle?: object
}

export default function ZoomableImage({ uri, thumbnailStyle }: ZoomableImageProps) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setVisible(true)}>
        <Image
          source={{ uri }}
          style={[{ width: "100%", height: 220, borderRadius: 8 }, thumbnailStyle]}
          resizeMode="cover"
        />
      </TouchableOpacity>

      <ImageViewing
        images={[{ uri }]}
        imageIndex={0}
        visible={visible}
        onRequestClose={() => setVisible(false)}
      />
    </>
  )
}
