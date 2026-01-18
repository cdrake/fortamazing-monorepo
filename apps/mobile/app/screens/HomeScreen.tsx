// src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { fetchUserHikes, type MobileHike } from "@/hooks/fetchUserHikes";
import { auth } from "@/config/firebase";
import type { AppStackScreenProps } from "@/navigators/navigationTypes";
import { useAppTheme } from "@/theme/context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = AppStackScreenProps<"Home">;



export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { themed } = useAppTheme();
  const [hikes, setHikes] = useState<MobileHike[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insets = useSafeAreaInsets();

  const ListHeader = () => (
  <View
    style={{
      paddingTop: insets.top + 12,
      paddingHorizontal: 16,
      paddingBottom: 8,
      backgroundColor: "transparent",
    }}
  >
    <Text size="xl" weight="bold">
      Hikes
    </Text>
  </View>
);


  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        setHikes([]);
        setError("Not signed in");
        return;
      }
      const items = await fetchUserHikes(user.uid);
      // debug: show what images/resolved urls we got
      // eslint-disable-next-line no-console
      console.log("HomeScreen: fetched hikes count:", items.length);
      items.forEach((it) => {
        // eslint-disable-next-line no-console
        console.log("HomeScreen: hike:", it.id, "images:", it.images, "thumbnailUrl:", it.thumbnailUrl);
      });

      setHikes(items);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn("HomeScreen: load error", err);
      setError(String(err?.message ?? err));
      setHikes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    // initial load
    void load();
    // optional: subscribe to auth changes to reload when user signs in/out
    // you can add onAuthStateChanged if desired
  }, [load]);

  const renderItem = ({ item }: { item: MobileHike }) => {
    const thumb = item.thumbnailUrl ?? null;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("HikeDetail" as any, { hikeId: item.id })}
        style={styles.itemContainer}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text size="xs">No photo</Text>
          </View>
        )}

        <View style={styles.itemContent}>
          <Text weight="bold">{item.title ?? "Untitled hike"}</Text>
          <Text size="sm" numberOfLines={2}>
            {Array.isArray(item.days) && item.days.length > 0
              ? `${item.days.length} day(s)`
              : item.ownerUsername ?? item.ownerUid ?? "No details"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen preset="fixed" contentContainerStyle={themed({ paddingTop: 8 })}>
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
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{
            paddingBottom: insets.bottom + 120,
        }}
        ListEmptyComponent={
            !loading ? <Text style={{ padding: 20 }}>No hikes found</Text> : null
        }
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        />

    </Screen>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
  },
  thumb: {
    width: 96,
    height: 64,
    borderRadius: 6,
    marginRight: 12,
  },
  thumbPlaceholder: {
    width: 96,
    height: 64,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  itemContent: {
    flex: 1,
  },
});

export default HomeScreen;
