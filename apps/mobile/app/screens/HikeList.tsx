// src/screens/HikesList.tsx
import React from "react";
import { View, FlatList, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Text } from "@/components/Text";
import { Screen } from "@/components/Screen";
import { useUserHikes } from "@/hooks/useUserHikes";
import type { AppStackScreenProps } from "@/navigators/navigationTypes";
import { useAppTheme } from "@/theme/context";

type Props = AppStackScreenProps<"Home">; // change route name if needed

export default function HikesList({ navigation }: Props) {
  const { hikes, loading, error } = useUserHikes();
  const { themed } = useAppTheme();

  function renderItem({ item }: { item: any }) {
    console.log("[HikesList] rendering item:", item);
    const thumb = (item.resolvedImageUrls && item.resolvedImageUrls[0]) ?? null;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("HikeDetail" as any, { hikeId: item.id })}
        style={themed({
          flexDirection: "row",
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#eee",
          alignItems: "center",
        })}
      >
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={{ width: 96, height: 64, borderRadius: 6, marginRight: 12 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 96,
              height: 64,
              borderRadius: 6,
              marginRight: 12,
              backgroundColor: "#f0f0f0",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text size="xs">No photo</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text weight="bold">{item.title}</Text>
          <Text size="sm" numberOfLines={2}>
            {item.descriptionMd ? item.descriptionMd.replace(/\n/g, " ") : "No description"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Screen preset="fixed">
      {loading && (
        <View style={{ padding: 20 }}>
          <ActivityIndicator />
          <Text>Loading hikes…</Text>
        </View>
      )}
      {error && <Text style={{ color: "red", padding: 12 }}>{error}</Text>}
      <FlatList
        data={hikes}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListEmptyComponent={!loading ? <Text style={{ padding: 20 }}>No hikes found</Text> : null}
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </Screen>
  );
}
