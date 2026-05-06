import { type FormEvent } from 'react';
import { Button, Label } from '@auction/ui';
import type { SubscriptionType } from '@auction/types';
import { SUBSCRIPTION_OPTIONS } from '../../lib/wizard';

export type PaymentDraft = {
  subscriptionType: SubscriptionType | '';
};

export const initialPaymentDraft = (): PaymentDraft => ({ subscriptionType: '' });

export function PaymentStep({
  value,
  onChange,
  onBack,
  onSubmit,
  busy,
  error,
}: {
  value: PaymentDraft;
  onChange: (next: PaymentDraft) => void;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label>
          Subscription <span className="text-destructive">*</span>
        </Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {SUBSCRIPTION_OPTIONS.map((o) => {
            const selected = value.subscriptionType === o.value;
            return (
              <label
                key={o.value}
                className={`cursor-pointer rounded-md border p-4 transition ${
                  selected ? 'border-primary bg-primary/5' : 'border-muted'
                }`}
              >
                <input
                  type="radio"
                  name="subscriptionType"
                  value={o.value}
                  checked={selected}
                  onChange={() => onChange({ subscriptionType: o.value })}
                  className="sr-only"
                />
                <p className="font-medium">{o.label}</p>
                <p className="text-sm text-muted-foreground">{o.blurb}</p>
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Pay Later — Offline Settlement</p>
        <p className="mt-2 text-muted-foreground">
          Submit your application below. Our team will share payment details (bank transfer in
          INR or AED) over email and confirm receipt before activating your account.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={busy || !value.subscriptionType}>
          {busy ? 'Submitting…' : 'Submit for Review'}
        </Button>
      </div>
    </form>
  );
}
