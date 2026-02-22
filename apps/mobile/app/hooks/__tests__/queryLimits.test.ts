/**
 * Verify that all mobile Firestore list hooks/fetchers pass `limit()` to
 * the Firestore query so we never fetch unbounded collections.
 *
 * These tests mock firebase/firestore and assert that `limit` is called
 * with the expected value.
 */

// ---- mocks ----
const mockOnSnapshot = jest.fn((_q, onNext, _onError) => {
  // Simulate an empty snapshot so the hook doesn't throw
  onNext({ docs: [] })
  return jest.fn() // unsubscribe
})

const mockGetDocs = jest.fn().mockResolvedValue({ docs: [] })
const mockLimit = jest.fn((n) => `__limit_${n}__`)
const mockQuery = jest.fn((...args) => args)
const mockOrderBy = jest.fn((field, dir) => `__orderBy_${field}_${dir}__`)
const mockCollection = jest.fn((...args) => args.join("/"))

jest.mock("firebase/firestore", () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  orderBy: (field: string, dir: string) => mockOrderBy(field, dir),
  limit: (n: number) => mockLimit(n),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  QuerySnapshot: jest.fn(),
  DocumentData: jest.fn(),
  doc: jest.fn(),
}))

jest.mock("@/config/firebase", () => ({
  db: "__mock_db__",
  auth: { currentUser: { uid: "test-uid" } },
  app: "__mock_app__",
}))

jest.mock("firebase/storage", () => ({
  getDownloadURL: jest.fn(),
  getStorage: jest.fn(),
  ref: jest.fn(),
}))

jest.mock("@/lib/images", () => ({
  resolveStoragePathToDownloadUrl: jest.fn(),
}))

import { renderHook } from "@testing-library/react-native"

// ---- tests ----

describe("Firestore query limits", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("useUserActivities passes limit(limitCount) to query", () => {
    const { useUserActivities } = require("../useUserActivities")
    renderHook(() => useUserActivities(25))

    expect(mockLimit).toHaveBeenCalledWith(25)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "__limit_25__",
    )
  })

  it("useUserActivities defaults to limit(100)", () => {
    const { useUserActivities } = require("../useUserActivities")
    renderHook(() => useUserActivities())

    expect(mockLimit).toHaveBeenCalledWith(100)
  })

  it("useUserHikes passes limit(limitCount) to query", () => {
    const { useUserHikes } = require("../useUserHikes")
    renderHook(() => useUserHikes(50))

    expect(mockLimit).toHaveBeenCalledWith(50)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "__limit_50__",
    )
  })

  it("fetchUserActivities passes limit(limitCount) to query", async () => {
    const { fetchUserActivities } = require("../fetchUserActivities")
    await fetchUserActivities("test-uid", 30)

    expect(mockLimit).toHaveBeenCalledWith(30)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "__limit_30__",
    )
  })

  it("fetchUserActivities defaults to limit(100)", async () => {
    const { fetchUserActivities } = require("../fetchUserActivities")
    await fetchUserActivities("test-uid")

    expect(mockLimit).toHaveBeenCalledWith(100)
  })

  it("fetchUserHikes passes limit(limitCount) to query", async () => {
    const { fetchUserHikes } = require("../fetchUserHikes")
    await fetchUserHikes("test-uid", 10)

    expect(mockLimit).toHaveBeenCalledWith(10)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "__limit_10__",
    )
  })
})
