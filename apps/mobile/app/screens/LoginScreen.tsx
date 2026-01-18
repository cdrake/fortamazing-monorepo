// src/screens/LoginScreen.tsx
import { ComponentType, FC, useEffect, useMemo, useRef, useState } from "react";
// eslint-disable-next-line no-restricted-imports
import { ActivityIndicator, Alert, Platform, TextInput, TextStyle, ViewStyle } from "react-native";

import { Button } from "@/components/Button";
import { PressableIcon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { TextField, type TextFieldAccessoryProps } from "@/components/TextField";
import { useAuth } from "@/context/AuthContext";
import type { AppStackScreenProps } from "@/navigators/navigationTypes";
import { useAppTheme } from "@/theme/context";
import type { ThemedStyle } from "@/theme/types";

import { signInWithGoogleAsync, signInWithFacebookAsync } from "@/lib/socialAuth";
import { signInWithGoogleNative } from "@/lib/googleNativeAuth";

interface LoginScreenProps extends AppStackScreenProps<"Login"> {}

export const LoginScreen: FC<LoginScreenProps> = () => {
  const authPasswordInput = useRef<TextInput>(null);

  const [authPassword, setAuthPassword] = useState("");
  const [isAuthPasswordHidden, setIsAuthPasswordHidden] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const { authEmail, setAuthEmail, setAuthToken, validationError } = useAuth();

  const { themed, theme: { colors } } = useAppTheme();

  const [isSocialLoading, setIsSocialLoading] = useState(false);
  // add to your useState list:
  const [debugMessage, setDebugMessage] = useState<string | null>(null)

  useEffect(() => {
    // Here is where you could fetch credentials from keychain or storage
    // and pre-fill the form fields.
    setAuthEmail("ignite@infinite.red");
    setAuthPassword("ign1teIsAwes0m3");
  }, [setAuthEmail]);

  const error = isSubmitted ? validationError : "";

  function login() {
    setIsSubmitted(true);
    setAttemptsCount(attemptsCount + 1);

    if (validationError) return;

    // Make a request to your server to get an authentication token.
    // If successful, reset the fields and set the token.
    setIsSubmitted(false);
    setAuthPassword("");
    setAuthEmail("");

    // We'll mock this with a fake token (replace with real auth later).
    setAuthToken(String(Date.now()));
  }

  const PasswordRightAccessory: ComponentType<TextFieldAccessoryProps> = useMemo(
    () =>
      function PasswordRightAccessory(props: TextFieldAccessoryProps) {
        return (
          <PressableIcon
            icon={isAuthPasswordHidden ? "view" : "hidden"}
            color={colors.palette.neutral800}
            containerStyle={props.style}
            size={20}
            onPress={() => setIsAuthPasswordHidden(!isAuthPasswordHidden)}
          />
        );
      },
    [isAuthPasswordHidden, colors.palette.neutral800],
  );

  // Social sign-in handlers with debug alerts
 async function handleGoogleSignIn() {
  setIsSocialLoading(true)
  try {
    const userCred = await signInWithGoogleNative()
    const idToken = await userCred.user.getIdToken()
    setAuthToken(idToken)
  } catch (e) {
    console.error("Google native sign-in failed", e)
    Alert.alert("Google Sign-In failed", String(e))
  } finally {
    setIsSocialLoading(false)
  }
}

async function handleFacebookSignIn() {
  setIsSocialLoading(true);
  setDebugMessage("Starting Facebook sign-in...");

  console.log("[Debug] handleFacebookSignIn - start - Platform:", Platform.OS);

  try {
    const result = await signInWithFacebookAsync();
    console.log("[Debug] handleFacebookSignIn - result:", result);

    if (result?.idToken) {
      setAuthToken(result.idToken);
      Alert.alert("Debug", `Facebook sign-in succeeded\nuid: ${result.uid}`);
    } else {
      console.warn("[Debug] Facebook sign-in returned no token", result);
      Alert.alert("Debug", `Facebook sign-in returned no token\nsee console logs for details`);
    }
  } catch (e) {
    console.warn("[Debug] Facebook sign-in error", e);
    Alert.alert("Debug", `Facebook sign-in exception:\n${String(e)}`);
  } finally {
    setIsSocialLoading(false);
    setTimeout(() => setDebugMessage(null), 2000);
  }
}


  return (
    <Screen
      preset="auto"
      contentContainerStyle={themed($screenContentContainer)}
      safeAreaEdges={["top", "bottom"]}
    >
      {/* Debug banner (non-blocking) */}
      {debugMessage ? (
        <Text
          style={themed({
            backgroundColor: "#111",
            color: "#fff",
            padding: 8,
            borderRadius: 6,
            alignSelf: "stretch",
            marginBottom: 12,
            textAlign: "center",
          })}
        >
          {debugMessage}
        </Text>
      ) : null}
      <Text testID="login-heading" tx="loginScreen:logIn" preset="heading" style={themed($logIn)} />
      <Text tx="loginScreen:enterDetails" preset="subheading" style={themed($enterDetails)} />
      {attemptsCount > 2 && (
        <Text tx="loginScreen:hint" size="sm" weight="light" style={themed($hint)} />
      )}

      <TextField
        value={authEmail}
        onChangeText={setAuthEmail}
        containerStyle={themed($textField)}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        labelTx="loginScreen:emailFieldLabel"
        placeholderTx="loginScreen:emailFieldPlaceholder"
        helper={error}
        status={error ? "error" : undefined}
        onSubmitEditing={() => authPasswordInput.current?.focus()}
      />

      <TextField
        ref={authPasswordInput}
        value={authPassword}
        onChangeText={setAuthPassword}
        containerStyle={themed($textField)}
        autoCapitalize="none"
        autoComplete="password"
        autoCorrect={false}
        secureTextEntry={isAuthPasswordHidden}
        labelTx="loginScreen:passwordFieldLabel"
        placeholderTx="loginScreen:passwordFieldPlaceholder"
        onSubmitEditing={login}
        RightAccessory={PasswordRightAccessory}
      />

      <Button
        testID="login-button"
        tx="loginScreen:tapToLogIn"
        style={themed($tapButton)}
        preset="reversed"
        onPress={login}
      />

      {/* Social sign-in area */}
      {isSocialLoading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        <>
          <Button
            testID="google-button"
            text="Sign in with Google"
            style={themed({ marginTop: 12 })}
            onPress={handleGoogleSignIn}
          />
          <Button
            testID="facebook-button"
            text="Sign in with Facebook"
            style={themed({ marginTop: 8 })}
            onPress={handleFacebookSignIn}
          />
        </>
      )}
    </Screen>
  );
};

const $screenContentContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.xxl,
  paddingHorizontal: spacing.lg,
});

const $logIn: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
});

const $enterDetails: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
});

const $hint: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.tint,
  marginBottom: spacing.md,
});

const $textField: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
});

const $tapButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
});
