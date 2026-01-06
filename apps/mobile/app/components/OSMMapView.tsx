import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import MapView, { UrlTile, Region } from "react-native-maps";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export type OSMMapViewProps = {
  height?: number;
  initialRegion?: Region;
  followUserOnMount?: boolean;
  showsUserLocation?: boolean;
  disableGesturesUntilTap?: boolean;
};

export const OSMMapView: React.FC<OSMMapViewProps> = ({
  height = 260,
  initialRegion,
  followUserOnMount = true,
  showsUserLocation = true,
  disableGesturesUntilTap = false,
}) => {
  const mapRef = useRef<MapView | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [gesturesEnabled, setGesturesEnabled] = useState(!disableGesturesUntilTap);

  const defaultRegion: Region = initialRegion ?? {
    latitude: 45,
    longitude: -122,
    latitudeDelta: 30,
    longitudeDelta: 30 * (width / height),
  };

  // request permission + optionally center on user
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;

        if (status !== "granted") {
          setHasPermission(false);
          return;
        }

        setHasPermission(true);

        if (followUserOnMount) {
          setBusy(true);
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          if (!mounted) return;

          mapRef.current?.animateToRegion(
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            },
            600
          );
        }
      } catch (err) {
        console.warn("OSMMapView location error", err);
        setHasPermission(false);
      } finally {
        setBusy(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [followUserOnMount]);

  const centerOnUser = useCallback(async () => {
    setBusy(true);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      mapRef.current?.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
    } catch (err) {
      console.warn("centerOnUser failed", err);
    } finally {
      setBusy(false);
    }
  }, []);

  const enableGestures = () => {
    if (disableGesturesUntilTap && !gesturesEnabled) {
      setGesturesEnabled(true);
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={(r) => { mapRef.current = r; }}
        style={styles.map}
        initialRegion={defaultRegion}
        showsUserLocation={hasPermission === true && showsUserLocation}
        scrollEnabled={gesturesEnabled}
        zoomEnabled={gesturesEnabled}
        rotateEnabled={gesturesEnabled}
        pitchEnabled={gesturesEnabled}
        onTouchStart={enableGestures}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          shouldReplaceMapContent
        />
      </MapView>

      {/* OSM attribution (required) */}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>

      {/* center button */}
      <TouchableOpacity
        style={styles.centerBtn}
        onPress={centerOnUser}
        disabled={busy}
        accessibilityLabel="Center map on your location"
      >
        {busy ? (
          <ActivityIndicator color="white" />
        ) : (
          <MaterialIcons name="my-location" size={20} color="white" />
        )}
      </TouchableOpacity>

      {/* permission message */}
      {hasPermission === false && (
        <View style={styles.permissionOverlay}>
          <Text style={styles.permissionText}>Location permission denied</Text>
          <Text style={styles.permissionSubtext}>
            Enable location to center the map on you
          </Text>
        </View>
      )}

      {/* tap-to-enable overlay */}
      {disableGesturesUntilTap && !gesturesEnabled && (
        <TouchableOpacity
          style={styles.tapOverlay}
          onPress={enableGestures}
          activeOpacity={0.9}
        >
          <Text style={styles.tapOverlayText}>
            Tap map to enable interaction
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default OSMMapView;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#eee",
    overflow: "hidden",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  attribution: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attributionText: {
    fontSize: 11,
    color: "#333",
  },
  centerBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1976D2",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  permissionOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 8,
  },
  permissionText: {
    color: "white",
    fontWeight: "600",
  },
  permissionSubtext: {
    color: "white",
    fontSize: 12,
    marginTop: 4,
  },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  tapOverlayText: {
    fontWeight: "600",
    color: "#333",
  },
});
