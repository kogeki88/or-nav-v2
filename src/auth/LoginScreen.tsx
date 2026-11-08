// Sign in / Create account form. Sits in the lower part of the screen, in thumb reach.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { S, T } from '../theme';
import { Banner, Button, Field } from '../ui/kit';
import { authConfigured, signIn, signUp } from './supabase';

type Mode = 'signIn' | 'create';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const problem = !email.includes('@')
    ? 'Enter your email address.'
    : password.length < 8
      ? mode === 'create'
        ? 'Choose a password with at least 8 characters.'
        : 'Enter your password.'
      : null;

  const submit = async () => {
    if (!authConfigured) return;
    if (problem) {
      setIsError(true);
      setMessage(problem);
      return;
    }
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
    <View style={{ gap: S.lg }}>
      <View style={{ gap: S.xs }}>
        <Text style={T.title} accessibilityRole="header">
          {mode === 'signIn' ? 'Sign in' : 'Create your account'}
        </Text>
        <Text style={T.callout}>{mode === 'signIn' ? 'Welcome back.' : 'It takes a minute. You stay signed in offline.'}</Text>
      </View>

      {!authConfigured && <Banner text="This build has no account settings. Install the next update." tone="danger" icon="alert-circle-outline" />}

      <Field
        label="Email"
        value={email}
        onChange={(v) => {
          setEmail(v);
          setMessage('');
        }}
        placeholder="name@hospital.org"
        keyboardType="email-address"
        autoComplete="email"
        editable={!busy}
      />
      <Field
        label="Password"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setMessage('');
        }}
        hint={mode === 'create' ? 'At least 8 characters.' : undefined}
        secret
        autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
        editable={!busy}
        onSubmit={submit}
      />

      {message !== '' && <Banner text={message} tone={isError ? 'danger' : 'accent'} icon={isError ? 'alert-circle-outline' : 'mail-outline'} />}

      <Button label={mode === 'signIn' ? 'Sign in' : 'Create account'} icon={mode === 'signIn' ? 'log-in-outline' : 'person-add-outline'} busy={busy} disabled={!authConfigured} onPress={submit} />

      <Button kind="ghost" label={mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'} onPress={switchMode} />
    </View>
  );
}
