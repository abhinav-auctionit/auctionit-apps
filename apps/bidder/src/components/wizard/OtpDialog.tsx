import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@auction/ui';

export function OtpDialog({
  open,
  target,
  busy,
  error,
  onVerify,
  onResend,
  onCancel,
}: {
  open: boolean;
  target: string;
  busy: boolean;
  error: string | null;
  onVerify: (code: string) => Promise<void> | void;
  onResend: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!open) setCode('');
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify your mobile</DialogTitle>
          <DialogDescription>
            We sent a 6-digit code to {target}. (In dev mode the code is printed in the API
            console.)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">OTP</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={busy}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-primary underline disabled:opacity-50"
              onClick={() => onResend()}
              disabled={busy}
            >
              Resend code
            </button>
            <Button onClick={() => onVerify(code)} disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Verify & Continue'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
