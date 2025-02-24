import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User, sendSignInLinkToEmail, ActionCodeSettings, sendEmailVerification } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, getDoc, query, where, setDoc, updateDoc, orderBy } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ✅ Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// ✅ Sign in with Google
const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
  }
};

// ✅ Sign out function
const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

export type UserProfile = {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  photoURL: string;
};

// ✅ Post Data Type
export interface Post {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  imageUrl: string;
  caption: string;
  categories: string[];  // ✅ Now supports multiple categories
  subcategories: string[];  // ✅ Now supports multiple subcategories
  tags: string[];  // ✅ List of tags
  date?: string;  // ✅ Optional date for events (YYYY-MM-DD format)
  time?: string;  // ✅ Optional time for events (HH:MM format)
  createdAt: string;  // ✅ ISO timestamp
}

// ✅ Upload a post (image + caption)
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
    date: date || null,  // ✅ Store event date if available
    time: time || null,  // ✅ Store event time if available
    createdAt: new Date().toISOString(),
  });

  return imageUrl;
};


// ✅ Fetch all posts
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
    // ✅ Start with the base query
    const postsRef = collection(db, "posts");

    // ✅ Build filters array
    const filters = [];

    if (userId) {
      filters.push(where("userId", "==", userId));
    }

    if (categories.length > 0) {
      filters.push(where("categories", "array-contains-any", categories));
    }

    if (subcategories.length > 0) {
      filters.push(where("subcategories", "array-contains-any", subcategories));
    }

    if (tags.length > 0) {
      filters.push(where("tags", "array-contains-any", tags));
    }

    // ✅ Apply filters and order
    const finalQuery = filters.length > 0
      ? query(postsRef, ...filters, orderBy("createdAt", "desc"))
      : query(postsRef, orderBy("createdAt", "desc"));

    // ✅ Execute the query
    const querySnapshot = await getDocs(finalQuery);

    // ✅ Map results to Post type
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Post[];

  } catch (error) {
    console.error("❌ Error fetching posts:", error);
    return [];
  }
};

// ✅ Function to delete a post
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

// ✅ Get user role from Firestore
const getUserRole = async (user: User | null): Promise<string> => {
  if (!user) {
    console.log('no user specified');
    return '';
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  return userSnap.exists() ? userSnap.data().role : 'user';
};

// ✅ Define action settings for the email link
const actionCodeSettings: ActionCodeSettings = {
  url: "https://fortamazing.com/signup",
  handleCodeInApp: true,
};

// ✅ Send Firebase Email Link (Native)
const generateInvite = async (email: string) => {
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  return `Invite sent to ${email}. Check your inbox.`;
};

// ✅ Function to fetch all invites
const fetchInvites = async () => {
  const inviteDocs = await getDocs(collection(db, "invites"));
  
  return inviteDocs.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email || "", // ✅ Ensure email is included
      code: data.code || "", // ✅ Ensure invite code is included
    };
  });
};

// ✅ Function to delete an invite
const deleteInvite = async (inviteId: string) => {
  await deleteDoc(doc(db, "invites", inviteId));
};

// ✅ Send a verification email
const sendVerificationEmail = async () => {
  const auth = getAuth();
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
    console.log("✅ Verification email sent.");
  } else {
    console.error("❌ No user signed in.");
  }
};

const authCheck = async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (user && !user.emailVerified) {
    throw new Error("Please verify your email before logging in.");
  }
};

// ✅ Convert email to URL-safe format
export const encodeEmailAsUsername = (email: string) => {
  return encodeURIComponent(email.replace(/@/g, "_at_"));
};

// ✅ Fetch user by encoded email or username
export const getUserByUsername = async (username: string) => {
  const q = query(collection(db, "users"), where("username", "==", username));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty ? null : querySnapshot.docs[0].data();
};

// ✅ Automatically create user profile with encoded email as username
export const createUserProfile = async (user: User) => {
  if (!user.email) throw new Error("User email is required");

  const sanitizedUsername = user.email.replace(/@/g, "."); // ✅ Replace "@" with "."

  const userRef = doc(db, "users", sanitizedUsername);

  await setDoc(userRef, {
    uid: user.uid,
    username: sanitizedUsername, // ✅ Use sanitized username
    email: user.email,
    displayName: user.displayName || "",
    photoURL: user.photoURL || "/default-avatar.png",
  });

  return sanitizedUsername;
};

// ✅ Allow users to update their username
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

// ✅ Get UID from username
const getUserUID = async (username: string): Promise<string | null> => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null; // ✅ No user found

    return querySnapshot.docs[0].id; // ✅ Return UID
  } catch (error) {
    console.error("Error fetching user UID:", error);
    return null;
  }
};

// ✅ Fetch user details by username
export const getUserProfile = async (username: string): Promise<UserProfile | null> => {
  try {
    const uid = await getUserUID(username);
    if (!uid) return null; // ✅ No user found

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return null; // ✅ No user profile found

    return userSnap.data() as UserProfile;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

// ✅ Fetch all usernames from Firestore
export const getAllUsernames = async (): Promise<{ username: string }[]> => {
  const usersRef = collection(db, "users");
  const querySnapshot = await getDocs(usersRef);

  return querySnapshot.docs.map((doc) => ({
    username: doc.data().username.replace(/@/g, "."), // ✅ Replace "@" with "." for URLs
  }));
};

export const getAllCategories = async (): Promise<string[]> => {
  // Option 1: Static list
  return ["Exercise", "Diet", "Wellness", "Event", "Equipment"];

  // Option 2: Dynamic from Firestore
  // const snapshot = await getDocs(collection(db, "categories"));
  // return snapshot.docs.map(doc => doc.data().name);
};


export { app, auth, db, storage, signInWithGoogle, logout, uploadPost, fetchPosts, deletePost, getUserRole, generateInvite, fetchInvites, deleteInvite, sendVerificationEmail, authCheck, updateProfilePicture, updateUsername };
