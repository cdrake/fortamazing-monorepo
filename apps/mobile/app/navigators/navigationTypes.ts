import { ComponentProps } from "react"
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs"
import {
  CompositeScreenProps,
  NavigationContainer,
  NavigatorScreenParams,
} from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"

import type { ActivityType } from "@/lib/activityClassification"
import type { GpsTrackResult } from "@/lib/gpsTypes"
import type { HealthKitWorkoutData } from "@/lib/healthKit"

// Demo Tab Navigator types
export type DemoTabParamList = {
  DemoCommunity: undefined
  DemoShowroom: { queryIndex?: string; itemIndex?: string }
  DemoDebug: undefined
  DemoPodcastList: undefined
}

// App Stack Navigator types
export type AppStackParamList = {
  Welcome: undefined
  Login: undefined
  Demo: NavigatorScreenParams<DemoTabParamList>

  // Your screens go here
  Home: undefined
  HikeDetail: { hikeId: string }
  ActivityDetail: { activityId: string }
  NewActivity: undefined
  Recording: { type: ActivityType }
  SaveActivity: {
    type: ActivityType
    trackData?: GpsTrackResult
    healthKitWorkout?: HealthKitWorkoutData
  }
  HealthKitImport: undefined
  // IGNITE_GENERATOR_ANCHOR_APP_STACK_PARAM_LIST
}

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>

export type DemoTabScreenProps<T extends keyof DemoTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<DemoTabParamList, T>,
  AppStackScreenProps<keyof AppStackParamList>
>

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<AppStackParamList>>
> {}
