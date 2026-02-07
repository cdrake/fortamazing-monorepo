import "@expo/metro-runtime" // this is for fast refresh on web w/o expo-router
import { registerRootComponent } from "expo"
import * as TaskManager from "expo-task-manager"
import { handleLocationUpdate } from "@/lib/gpsRecorder"

// Background location task must be registered at module level before React tree mounts
TaskManager.defineTask("BACKGROUND_LOCATION", async ({ data, error }) => {
  if (error || !data) return
  handleLocationUpdate((data as any).locations)
})

import { App } from "@/app"

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App)
