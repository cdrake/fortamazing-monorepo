import {
  ACTIVITY_TYPE_ICON,
  ACTIVITY_TYPE_LABEL,
  type ActivityType,
} from "../activityClassification"

const ALL_TYPES: ActivityType[] = [
  "hike", "walk", "run", "bike", "climb", "ski", "kayak", "swim", "workout", "other",
]

describe("ACTIVITY_TYPE_ICON", () => {
  it("has an icon for every activity type", () => {
    for (const type of ALL_TYPES) {
      expect(ACTIVITY_TYPE_ICON[type]).toBeDefined()
      expect(typeof ACTIVITY_TYPE_ICON[type]).toBe("string")
      expect(ACTIVITY_TYPE_ICON[type].length).toBeGreaterThan(0)
    }
  })

  it("returns correct icon for hike", () => {
    expect(ACTIVITY_TYPE_ICON.hike).toBe("🥾")
  })
})

describe("ACTIVITY_TYPE_LABEL", () => {
  it("has a label for every activity type", () => {
    for (const type of ALL_TYPES) {
      expect(ACTIVITY_TYPE_LABEL[type]).toBeDefined()
      expect(typeof ACTIVITY_TYPE_LABEL[type]).toBe("string")
    }
  })

  it("returns capitalized labels", () => {
    for (const type of ALL_TYPES) {
      const label = ACTIVITY_TYPE_LABEL[type]
      expect(label[0]).toBe(label[0].toUpperCase())
    }
  })
})
