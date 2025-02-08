import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User, sendSignInLinkToEmail, ActionCodeSettings, sendEmailVerification } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";
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

// ✅ Post Data Type
export interface Post {
  id: string; // ✅ Ensure id is included
  userId: string;
  userName: string;
  imageUrl: string;
  caption?: string;
  createdAt: string;
}
// ✅ Upload a post (image + caption)
const uploadPost = async (file: File, caption: string) => {
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
    createdAt: new Date().toISOString(),
  });

  return imageUrl;
};


// ✅ Fetch all posts
const fetchPosts = async (): Promise<Post[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "posts"));

    return querySnapshot.docs.map((doc) => ({
      id: doc.id, // ✅ Add document ID manually
      ...doc.data(), // ✅ Spread the Firestore document data
    })) as Post[];
  } catch (error) {
    console.error("Error fetching posts:", error);
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
const getUserRole = async (user: User | null): Promise<string | null> => {
  if (!user) {
    console.log('no user specified');
    return null;
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  return userSnap.exists() ? userSnap.data().role : null;
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
  const querySnapshot = await getDocs(collection(db, "invites"));
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    email: doc.data().email, // ✅ Ensure email is included
    code: doc.data().code,   // ✅ Ensure code is included
  }));
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

export { app, auth, db, storage, signInWithGoogle, logout, uploadPost, fetchPosts, deletePost, getUserRole, generateInvite, fetchInvites, deleteInvite, sendVerificationEmail, authCheck };
