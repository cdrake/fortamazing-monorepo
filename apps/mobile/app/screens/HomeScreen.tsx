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
import ActivityTypeIcon from "@/components/ActivityTypeIcon";
import { fetchUserActivities, type MobileActivity } from "@/hooks/fetchUserActivities";
import type { ActivityType, WorkoutData } from "@/lib/activityClassification";
import { auth } from "@/config/firebase";
import type { AppStackScreenProps } from "@/navigators/navigationTypes";
import { useAppTheme } from "@/theme/context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = AppStackScreenProps<"Home">;



export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { themed } = useAppTheme();
  const [hikes, setHikes] = useState<MobileActivity[]>([]);
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
      Activities
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
      const items = await fetchUserActivities(user.uid);
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

  const renderItem = ({ item }: { item: MobileActivity }) => {
    const thumb = item.thumbnailUrl ?? null;
    const actType = (item.type ?? "other") as ActivityType;
    const isWorkout = actType === "workout";
    const workout = item.raw?.workout as WorkoutData | undefined;

    let subtitle: string;
    if (isWorkout && workout?.exercises?.length) {
      const exCount = workout.exercises.length;
      const setCount = workout.exercises.reduce((s, ex) => s + (ex.sets?.length ?? 0), 0);
      subtitle = `${exCount} exercise${exCount !== 1 ? "s" : ""}, ${setCount} set${setCount !== 1 ? "s" : ""}`;
    } else if (Array.isArray(item.days) && item.days.length > 0) {
      subtitle = `${item.days.length} day(s)`;
    } else {
      subtitle = item.ownerUsername ?? item.ownerUid ?? "No details";
    }

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ActivityTypeIcon type={actType} size={18} />
            <Text weight="bold" style={{ flex: 1 }}>{item.title ?? "Untitled"}</Text>
          </View>
          <Text size="sm" numberOfLines={2}>
            {subtitle}
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
          <Text>Loading activities…</Text>
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
            !loading ? <Text style={{ padding: 20 }}>No activities found</Text> : null
        }
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("NewActivity")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  fab: {
    position: "absolute",
    bottom: 32,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4A90D9",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "bold",
  },
});

export default HomeScreen;
