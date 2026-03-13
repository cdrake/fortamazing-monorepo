import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User, sendSignInLinkToEmail, ActionCodeSettings, sendEmailVerification, FacebookAuthProvider, signInWithRedirect } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, getDoc, query, where, setDoc, updateDoc, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
export type { UserProfile } from "@fortamazing/lib/types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: "G-FX8J27FEDK"
};

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Sign in with Google
const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
  }
};

export async function signInWithFacebook(): Promise<User | null> {
  const provider = new FacebookAuthProvider();
  provider.addScope("email");

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch {
    // fallback to redirect when popup is blocked
    await signInWithRedirect(auth, provider);
    return null; // firebase will complete login after redirect
  }
}

// Sign out function
const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
};


// Post Data Type
export interface Post {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  imageUrl: string;
  caption: string;
  categories: string[];
  subcategories: string[];
  tags: string[];
  date?: string;
  time?: string;
  createdAt: string;
}

// Upload a post (image + caption)
const uploadPost = async (
  file: File,
  caption: string,
  categories: string[],
  subcategories: string[],
  tags: string[],
  date?: string,
  time?: string
) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in to upload.");

  const storageRef = ref(storage, `posts/${user.uid}/${file.name}`);
  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, "posts"), {
    userId: user.uid,
    userName: user.displayName || "Anonymous",
    userPhoto: user.photoURL || "/default-avatar.png",
    imageUrl,
    caption,
    categories,
    subcategories,
    tags,
    date: date || null,
    time: time || null,
    createdAt: new Date().toISOString(),
  });

  return imageUrl;
};


// Fetch all posts
// NOTE: Firestore supports at most ONE `array-contains-any` filter per query.
// When multiple array filters are provided we apply the first as a Firestore
// constraint and the remaining filters client-side to avoid runtime errors.
// See: https://firebase.google.com/docs/firestore/query-data/queries#limits_on_or_queries
const fetchPosts = async ({
  userId,
  categories = [],
  subcategories = [],
  tags = [],
}: {
  userId?: string;
  categories?: string[];
  subcategories?: string[];
  tags?: string[];
} = {}): Promise<Post[]> => {
  try {
    const postsRef = collection(db, "posts");

    // Build Firestore-compatible filters (max 1 array-contains-any)
    const firestoreFilters = [];
    if (userId) {
      firestoreFilters.push(where("userId", "==", userId));
    }

    // Pick at most one array-contains-any for the server query
    type ArrayFilter = { field: string; values: string[] };
    const arrayFilters: ArrayFilter[] = [];
    if (categories.length > 0) arrayFilters.push({ field: "categories", values: categories });
    if (subcategories.length > 0) arrayFilters.push({ field: "subcategories", values: subcategories });
    if (tags.length > 0) arrayFilters.push({ field: "tags", values: tags });

    // Apply the first array filter server-side (if any)
    if (arrayFilters.length > 0) {
      const first = arrayFilters[0];
      firestoreFilters.push(where(first.field, "array-contains-any", first.values));
    }

    const finalQuery = firestoreFilters.length > 0
      ? query(postsRef, ...firestoreFilters, orderBy("createdAt", "desc"))
      : query(postsRef, orderBy("createdAt", "desc"));

    const querySnapshot = await getDocs(finalQuery);

    let results = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Post[];

    // Apply remaining array filters client-side
    for (let i = 1; i < arrayFilters.length; i++) {
      const { field, values } = arrayFilters[i];
      results = results.filter((post) => {
        const arr = (post as unknown as Record<string, unknown>)[field];
        if (!Array.isArray(arr)) return false;
        return values.some((v) => arr.includes(v));
      });
    }

    return results;
  } catch (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
};

// Function to delete a post
const deletePost = async (postId: string, imageUrl: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in to delete a post.");

  try {
    // Delete the Firestore document
    await deleteDoc(doc(db, "posts", postId));

    // Delete the image from Firebase Storage
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);

    console.log("Post deleted successfully.");
  } catch (error) {
    console.error("Error deleting post:", error);
  }
};

// Get user role from Firestore
const getUserRole = async (user: User | null): Promise<string> => {
  if (!user) {
    console.log('no user specified');
    return '';
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  return userSnap.exists() ? userSnap.data().role : 'user';
};

// Define action settings for the email link
const actionCodeSettings: ActionCodeSettings = {
  url: "https://fortamazing.com/signup",
  handleCodeInApp: true,
};

// Send Firebase Email Link (Native)
const generateInvite = async (email: string) => {
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  return `Invite sent to ${email}. Check your inbox.`;
};

// Function to fetch all invites
const fetchInvites = async () => {
  const inviteDocs = await getDocs(collection(db, "invites"));

  return inviteDocs.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email || "",
      code: data.code || "",
    };
  });
};

// Function to delete an invite
const deleteInvite = async (inviteId: string) => {
  await deleteDoc(doc(db, "invites", inviteId));
};

// Send a verification email
const sendVerificationEmail = async () => {
  const auth = getAuth();
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
    console.log("Verification email sent.");
  } else {
    console.error("No user signed in.");
  }
};

const authCheck = async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (user && !user.emailVerified) {
    throw new Error("Please verify your email before logging in.");
  }
};

// Convert email to URL-safe format
export const encodeEmailAsUsername = (email: string) => {
  return encodeURIComponent(email.replace(/@/g, "_at_"));
};

// Fetch user by encoded email or username
export const getUserByUsername = async (username: string) => {
  const q = query(collection(db, "users"), where("username", "==", username));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty ? null : querySnapshot.docs[0].data();
};

// Automatically create user profile with encoded email as username
export const createUserProfile = async (user: User) => {
  if (!user.email) throw new Error("User email is required");

  const sanitizedUsername = user.email.replace(/@/g, ".");

  const userRef = doc(db, "users", sanitizedUsername);

  await setDoc(userRef, {
    uid: user.uid,
    username: sanitizedUsername,
    email: user.email,
    displayName: user.displayName || "",
    photoURL: user.photoURL || "/default-avatar.png",
  });

  return sanitizedUsername;
};

// Allow users to update their username
const updateUsername = async (userId: string, newUsername: string) => {
  const q = query(collection(db, "users"), where("username", "==", newUsername));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    throw new Error("Username already taken");
  }

  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { username: newUsername.toLowerCase() });
};

const updateProfilePicture = async (userId: string, file: File): Promise<string> => {
  const storageRef = ref(storage, `profile_pictures/${userId}/${file.name}`);
  await uploadBytes(storageRef, file);
  const newPhotoURL = await getDownloadURL(storageRef);

  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { photoURL: newPhotoURL });

  return newPhotoURL;
};

// Get UID from username
export const getUserUID = async (username: string): Promise<string | null> => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    return querySnapshot.docs[0].id;
  } catch (error) {
    console.error("Error fetching user UID:", error);
    return null;
  }
};

// Fetch user details by username
export const getUserProfile = async (username: string): Promise<UserProfile | null> => {
  try {
    const uid = await getUserUID(username);
    if (!uid) return null;

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return null;

    return userSnap.data() as UserProfile;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

// Fetch all usernames from Firestore
export const getAllUsernames = async (): Promise<{ username: string }[]> => {
  const usersRef = collection(db, "users");
  const querySnapshot = await getDocs(usersRef);

  return querySnapshot.docs.map((doc) => ({
    username: doc.data().username.replace(/@/g, "."),
  }));
};

export const getAllCategories = async (): Promise<string[]> => {
  // Option 1: Static list
  return ["Exercise", "Diet", "Wellness", "Event", "Equipment"];

  // Option 2: Dynamic from Firestore
  // const snapshot = await getDocs(collection(db, "categories"));
  // return snapshot.docs.map(doc => doc.data().name);
};


// ----------------------------------------
// ACTIVITIES (replaces hikes + posts)
// ----------------------------------------

export type ActivityDoc = {
  id: string;
  ownerId: string;
  type: string;
  title: string;
  description?: string;
  descriptionMd?: string;
  createdAt: unknown;
  updatedAt?: unknown;
  privacy: string;
  public?: boolean;
  adventureId?: string;
  photos?: unknown[];
  images?: unknown[];
  photoCount?: number;
  track?: Record<string, unknown>;
  days?: unknown[];
  owner?: { uid: string };
  [key: string]: unknown;
};

const activitiesCollectionFor = (uid: string) =>
  collection(db, "users", uid, "activities");

export const createActivity = async (
  data: Omit<ActivityDoc, "id" | "createdAt" | "updatedAt">
) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");
  const uid = (data.ownerId as string) || user.uid;
  const colRef = activitiesCollectionFor(uid);
  const now = new Date().toISOString();
  const docRef = await addDoc(colRef, {
    ...data,
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: now,
  });
  return docRef.id;
};

export const listActivities = async (
  uid: string,
  maxItems = 100
): Promise<ActivityDoc[]> => {
  const colRef = activitiesCollectionFor(uid);
  const q = query(colRef, orderBy("createdAt", "desc"), limit(maxItems));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityDoc));
};

export const getActivity = async (
  uid: string,
  activityId: string
): Promise<ActivityDoc | null> => {
  const docRef = doc(db, "users", uid, "activities", activityId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ActivityDoc;
};

export const updateActivity = async (
  uid: string,
  activityId: string,
  data: Partial<ActivityDoc>
) => {
  const docRef = doc(db, "users", uid, "activities", activityId);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
};

export const deleteActivity = async (uid: string, activityId: string) => {
  const docRef = doc(db, "users", uid, "activities", activityId);
  await deleteDoc(docRef);
};

export { app, auth, db, storage, collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, query, where, signInWithGoogle, logout, uploadPost, fetchPosts, deletePost, getUserRole, generateInvite, fetchInvites, deleteInvite, sendVerificationEmail, authCheck, updateProfilePicture, updateUsername, limit, serverTimestamp };
