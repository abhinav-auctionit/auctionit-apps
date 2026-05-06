import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@auction/api-client';
import { useApiClient, useAuth } from '@auction/auth';
import { loginSchema } from '@auction/types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@auction/ui';
import { MobileInput } from '../components/wizard/MobileInput';
import { COUNTRY_CODES } from '../lib/wizard';

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Sign-in failed';

export function LoginPage() {
  const { login, loginEmailOtp, loginMobileOtp } = useAuth();
  const api = useApiClient();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to bid</CardTitle>
          <CardDescription>Choose how you want to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="password">Email + Password</TabsTrigger>
              <TabsTrigger value="email-otp">Email + OTP</TabsTrigger>
              <TabsTrigger value="mobile-otp">Mobile + OTP</TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="pt-4">
              <PasswordForm
                onSubmit={async (email, password) => {
                  await login({ email, password });
                  navigate(from, { replace: true });
                }}
              />
            </TabsContent>

            <TabsContent value="email-otp" className="pt-4">
              <EmailOtpForm
                onSend={(email) => api.auth.loginEmailOtpSend({ email })}
                onVerify={async (email, code) => {
                  await loginEmailOtp({ email, code });
                  navigate(from, { replace: true });
                }}
              />
            </TabsContent>

            <TabsContent value="mobile-otp" className="pt-4">
              <MobileOtpForm
                onSend={(mobileCountryCode, mobileNumber) =>
                  api.auth.loginMobileOtpSend({ mobileCountryCode, mobileNumber })
                }
                onVerify={async (mobileCountryCode, mobileNumber, code) => {
                  await loginMobileOtp({ mobileCountryCode, mobileNumber, code });
                  navigate(from, { replace: true });
                }}
              />
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link to="/register" className="text-primary underline">
              Create a bidder account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function PasswordForm({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(parsed.data.email, parsed.data.password);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="email-pw">Email</Label>
        <Input
          id="email-pw"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-pw">Password</Label>
        <Input
          id="password-pw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

function EmailOtpForm({
  onSend,
  onVerify,
}: {
  onSend: (email: string) => Promise<void>;
  onVerify: (email: string, code: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'send' | 'verify'>('send');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSend(email);
      setStage('verify');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onVerify(email, code);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'send') {
    return (
      <form className="space-y-4" onSubmit={send}>
        <div className="space-y-2">
          <Label htmlFor="email-otp">Email</Label>
          <Input
            id="email-otp"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Sending…' : 'Send OTP'}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={verify}>
      <p className="text-sm text-muted-foreground">
        Code sent to <span className="font-medium text-foreground">{email}</span>. Dev mode prints
        it in the API console.
      </p>
      <div className="space-y-2">
        <Label htmlFor="email-code">OTP</Label>
        <Input
          id="email-code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => {
            setStage('send');
            setCode('');
            setError(null);
          }}
        >
          Use a different email
        </button>
        <Button type="submit" disabled={busy || code.length !== 6}>
          {busy ? 'Verifying…' : 'Verify & Sign In'}
        </Button>
      </div>
    </form>
  );
}

function MobileOtpForm({
  onSend,
  onVerify,
}: {
  onSend: (cc: string, num: string) => Promise<void>;
  onVerify: (cc: string, num: string, code: string) => Promise<void>;
}) {
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]!.code);
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'send' | 'verify'>('send');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSend(countryCode, number);
      setStage('verify');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onVerify(countryCode, number, code);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'send') {
    return (
      <form className="space-y-4" onSubmit={send}>
        <MobileInput
          id="mobile-login"
          label="Mobile"
          countryCode={countryCode}
          number={number}
          onCountryChange={setCountryCode}
          onNumberChange={setNumber}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy || number.length < 7} className="w-full">
          {busy ? 'Sending…' : 'Send OTP'}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={verify}>
      <p className="text-sm text-muted-foreground">
        Code sent to{' '}
        <span className="font-medium text-foreground">
          {countryCode} {number}
        </span>
        . Dev mode prints it in the API console.
      </p>
      <div className="space-y-2">
        <Label htmlFor="mobile-code">OTP</Label>
        <Input
          id="mobile-code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => {
            setStage('send');
            setCode('');
            setError(null);
          }}
        >
          Use a different number
        </button>
        <Button type="submit" disabled={busy || code.length !== 6}>
          {busy ? 'Verifying…' : 'Verify & Sign In'}
        </Button>
      </div>
    </form>
  );
}
