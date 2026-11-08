// Sign in / Create account form. OR Dark Mode, 56dp targets, sits in the lower part of the screen.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { authConfigured, signIn, signUp } from './supabase';
import { C } from '../theme';

type Mode = 'signIn' | 'create';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const canSubmit = authConfigured && !busy && email.includes('@') && password.length >= 8;

  const submit = async () => {
    setBusy(true);
    setMessage('');
    setIsError(false);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        const mustConfirm = await signUp(email, password);
        if (mustConfirm) {
          setMode('signIn');
          setPassword('');
          setMessage(`Check ${email.trim()} for a confirmation link. Open it, then sign in here.`);
        }
      }
    } catch (e) {
      setIsError(true);
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signIn' ? 'create' : 'signIn');
    setMessage('');
    setIsError(false);
  };

  return (
    <View style={styles.form}>
      <Text style={styles.heading}>{mode === 'signIn' ? 'Sign in' : 'Create account'}</Text>

      {!authConfigured && (
        <Text style={[styles.message, styles.error]}>
          This build has no account settings. Install the next update.
        </Text>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder={mode === 'create' ? 'Password (8+ characters)' : 'Password'}
        placeholderTextColor={C.muted}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
        textContentType={mode === 'create' ? 'newPassword' : 'password'}
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        onSubmitEditing={() => canSubmit && submit()}
      />

      {message !== '' && <Text style={[styles.message, isError && styles.error]}>{message}</Text>}

      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={submit}
        style={({ pressed }) => [styles.primary, (!canSubmit || pressed) && styles.dim]}
      >
        {busy ? (
          <ActivityIndicator color={C.bg} />
        ) : (
          <Text style={styles.primaryText}>{mode === 'signIn' ? 'Sign in' : 'Create account'}</Text>
        )}
      </Pressable>

      <Pressable accessibilityRole="button" onPress={switchMode} disabled={busy} style={styles.link}>
        <Text style={styles.linkText}>
          {mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  heading: { color: C.text, fontSize: 24, fontWeight: '700', marginBottom: 4 },
  input: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: C.card,
    color: C.text,
    fontSize: 18,
    paddingHorizontal: 16,
  },
  message: { color: C.muted, fontSize: 16 },
  error: { color: C.danger },
  primary: {
    minHeight: 60,
    borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: C.bg, fontSize: 19, fontWeight: '700' },
  dim: { opacity: 0.6 },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: C.accent, fontSize: 17, fontWeight: '600' },
});
