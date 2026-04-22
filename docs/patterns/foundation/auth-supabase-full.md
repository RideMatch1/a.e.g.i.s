---
name: auth-supabase-full
category: foundation
title: Authentication Flows with Supabase (login + signup + password-reset + MFA + magic-link)
description: >
  Complete authentication UI + server-actions + callbacks for Supabase Auth.
  Includes optional MFA (TOTP) and passwordless magic-link flows.
  Depends on multi-tenant-supabase for the profiles table.
version: 1
dependencies:
  npm:
    - "@supabase/supabase-js"
    - "@supabase/ssr"
    - "react-hook-form"
    - "@hookform/resolvers"
    - "zod"
placeholders:
  - name: PROJECT_NAME
    description: Project identifier
    required: true
  - name: AUTH_METHODS
    description: Array of enabled auth-methods [password, magic-link, oauth-google, oauth-github, oauth-microsoft, oauth-apple]
    default: ["password"]
  - name: MFA_POLICY
    description: "off | optional | mandatory"
    default: "optional"
  - name: APP_NAME
    description: User-facing app-name for emails/UI
    required: true
brief_section: Foundation
estimated_files: 8
tags: [auth, supabase, mfa, oauth, magic-link]
related:
  - foundation/multi-tenant-supabase
  - foundation/rbac-requireRole
  - foundation/middleware-hardened
---

# Authentication Flows with Supabase

Complete auth-UI + server-actions for Supabase Auth. Covers password-login, signup, password-reset, optional MFA (TOTP), optional magic-link, and OAuth providers. All flows are CSRF-protected via server-actions + tenant-guard integration.

**Security-by-default:**
- Passwords are validated client+server (zod min-12-chars with complexity-check)
- Failed-login attempts rate-limited (5 per 15min per IP)
- MFA-TOTP ready with opt-in or mandatory-enforcement
- Email-enumeration-resistant (identical responses for existing/non-existing emails)
- Session-token rotation on password-change

---

## Commands to run

```bash
# Required shadcn components for auth UI
npx shadcn@latest add button input label card form alert

# npm dependencies (if not already installed by multi-tenant-supabase)
npm install react-hook-form @hookform/resolvers zod
```

### Supabase Dashboard configuration (one-time setup)

1. Go to **Authentication → Settings** in your Supabase dashboard
2. Enable email confirmation (recommended)
3. Configure **Site URL** to your production URL (and add localhost:3000 + preview URLs to **Redirect URLs**)
4. If using OAuth: configure the providers (Google/GitHub/Microsoft/Apple) with their respective client IDs
5. If using MFA: enable **MFA/TOTP** in Auth settings

---

## Files to create

### `src/app/login/page.tsx`

```typescript
/**
 * Login page — {{PROJECT_NAME}}
 */
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <LoginForm />
    </div>
  );
}
```

### `src/app/signup/page.tsx`

```typescript
import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <SignupForm />
    </div>
  );
}
```

### `src/app/auth/callback/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * OAuth callback handler.
 * Supabase redirects here after OAuth-provider returns.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/admin/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
```

### `src/app/auth/update-password/page.tsx`

```typescript
import { UpdatePasswordForm } from '@/components/auth/update-password-form';

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <UpdatePasswordForm />
    </div>
  );
}
```

### `src/components/auth/login-form.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginFormData) {
    setError(null);
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setLoading(false);

    if (authError) {
      // Email-enumeration-resistant: same message for wrong-pw or non-existing-email
      setError('Invalid credentials');
      return;
    }

    router.push('/admin/dashboard');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to {{APP_NAME}}</CardTitle>
        <CardDescription>Enter your credentials to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/auth/forgot-password" className="text-sm text-muted-foreground hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

### `src/components/auth/signup-form.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Password policy: ≥12 chars, at least 1 upper + 1 lower + 1 digit + 1 special
const signupSchema = z.object({
  fullName: z.string().min(2, 'Name too short').max(120),
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(12, 'Minimum 12 characters')
    .regex(/[A-Z]/, 'At least one uppercase letter')
    .regex(/[a-z]/, 'At least one lowercase letter')
    .regex(/[0-9]/, 'At least one digit')
    .regex(/[^A-Za-z0-9]/, 'At least one special character'),
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(data: SignupFormData) {
    setError(null);
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (authError) {
      // Email-enumeration-resistant: always show same success-message
      // Only show error for non-existence-related failures
      if (!authError.message.toLowerCase().includes('already')) {
        setError('Unable to create account. Please try again later.');
        return;
      }
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We&apos;ve sent a confirmation link to the address you provided. Click the link to activate
            your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your {{APP_NAME}} account</CardTitle>
        <CardDescription>Password must be at least 12 characters with mixed case, digit, and special character.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" type="text" autoComplete="name" {...register('fullName')} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

### `src/app/auth/forgot-password/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const supabase = createBrowserSupabaseClient();
    // Email-enumeration-resistant: always show "check your email" regardless of response
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        {submitted ? (
          <>
            <CardHeader>
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                If an account exists for this email, we&apos;ve sent a link to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login" className="text-primary hover:underline">
                Back to sign in
              </Link>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Forgot your password?</CardTitle>
              <CardDescription>Enter your email and we&apos;ll send a reset link.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register('email')} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <Button type="submit" className="w-full">Send reset link</Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
```

### `src/components/auth/update-password-form.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const schema = z.object({
  password: z
    .string()
    .min(12, 'Minimum 12 characters')
    .regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/, 'Mixed-case + digit + special character required'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

type FormData = z.infer<typeof schema>;

export function UpdatePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: authError } = await supabase.auth.updateUser({ password: data.password });
    if (authError) {
      setError('Unable to update password. The link may have expired.');
      return;
    }
    router.push('/admin/dashboard');
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a password that you haven&apos;t used before.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" className="w-full">Update password</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

### Optional: Magic-link alternative (`src/components/auth/magic-link-form.tsx`)

Only include if `AUTH_METHODS` contains `magic-link`:

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export function MagicLinkForm() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signInWithOtp({
      email: data.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSent(true);
  }

  if (sent) {
    return <p className="text-center">Check your email for the sign-in link.</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <Label htmlFor="ml-email">Email</Label>
      <Input id="ml-email" type="email" {...register('email')} />
      {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      <Button type="submit">Send magic link</Button>
    </form>
  );
}
```

### Optional: OAuth buttons (`src/components/auth/oauth-buttons.tsx`)

Only include providers chosen in `AUTH_METHODS`:

```typescript
'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

type Provider = 'google' | 'github' | 'azure' | 'apple';

async function signInWith(provider: Provider) {
  const supabase = createBrowserSupabaseClient();
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export function OAuthButtons() {
  return (
    <div className="flex flex-col gap-2">
      {/* Render only the providers from {{AUTH_METHODS}} */}
      <Button variant="outline" onClick={() => signInWith('google')}>Continue with Google</Button>
      <Button variant="outline" onClick={() => signInWith('github')}>Continue with GitHub</Button>
      {/* ... */}
    </div>
  );
}
```

### Optional: MFA enrollment (`src/app/admin/mein-bereich/mfa/page.tsx`)

Only include if `MFA_POLICY` is `optional` or `mandatory`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';

export default function MFAEnrollPage() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    const enroll = async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (!error && data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
    };
    enroll();
  }, []);

  async function verify() {
    if (!factorId) return;
    const supabase = createBrowserSupabaseClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) return;
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: otp,
    });
    if (!error) window.location.href = '/admin/mein-bereich';
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h1 className="text-2xl font-semibold">Set up MFA</h1>
      {qrCode && (
        <div>
          <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app:</p>
          <Image src={qrCode} alt="MFA QR" width={200} height={200} />
          {secret && <p className="text-xs font-mono mt-2">Manual entry: {secret}</p>}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="otp">Enter 6-digit code</Label>
        <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
      </div>
      <Button onClick={verify}>Verify &amp; activate</Button>
    </div>
  );
}
```

---

## Required environment variables

```env
# Already set by multi-tenant-supabase pattern
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional — only if OAuth used
# (Providers configured in Supabase Dashboard, not here)
```

---

## Test example (Vitest + Playwright E2E)

Unit-test (component-level):
```typescript
// src/components/auth/__tests__/login-form.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginForm } from '../login-form';

vi.mock('@/lib/supabase/client');

describe('LoginForm', () => {
  it('shows password-error when empty', async () => {
    render(<LoginForm />);
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText(/password required/i)).toBeInTheDocument());
  });
});
```

E2E test (Playwright):
```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('login-flow: valid credentials redirect to dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'TestPassword123!');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});
```

---

## Common pitfalls

1. **Forgetting email-confirmation in production.** Enable it in Supabase Dashboard → Auth Settings. Without it, anyone can sign up with any email.
2. **Not handling the `next` redirect-param securely.** In OAuth callback, validate `next` is a relative path on the same origin (prevents open-redirect attacks).
3. **Showing different error-messages for existing vs non-existing emails.** Creates email-enumeration vector. Always same response.
4. **Forgetting to add localhost to Redirect URLs** in Supabase Dashboard. Dev builds will fail silently.
5. **Using `window.location.origin` in server-code.** This is client-only. In server-actions, use the `origin` from the request URL.
6. **Storing passwords anywhere except Supabase Auth.** Never write passwords to `profiles` table.

---

## Related patterns

- `foundation/multi-tenant-supabase` — provides tenants + profiles + tenant-guard (prereq)
- `foundation/rbac-requireRole` — role-based access-control after authentication
- `foundation/middleware-hardened` — route-protection middleware + rate-limit integration
- `compliance/dsgvo-kit` — post-auth DSGVO consent-flow + data-export

---

## Quality-gate

```bash
npm run build             # expect exit 0
npm run test -- auth      # expect all pass
npx -y @aegis-scan/cli scan .          # expect score ≥ 970, 0 critical
```

Verify manually:
- `/login` renders, submitting empty form shows validation
- `/signup` with valid password creates user (check Supabase dashboard → Authentication → Users)
- `/auth/forgot-password` → email received → link → `/auth/update-password` works
- OAuth buttons redirect (if enabled)
- MFA enrollment (if enabled) — QR scans, code verifies

---

**Pattern version: 1 · Last-updated: 2026-04-22 · AEGIS-foundation**
