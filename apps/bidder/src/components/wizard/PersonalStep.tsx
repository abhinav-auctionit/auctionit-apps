import { useState, type FormEvent } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@auction/ui';
import type { InterestedIn } from '@auction/types';
import { COUNTRY_CODES, INTERESTED_IN_OPTIONS } from '../../lib/wizard';
import { MobileInput } from './MobileInput';

export type PersonalDraft = {
  interestedIn: InterestedIn;
  fullName: string;
  email: string;
  mobileCountryCode: string;
  mobileNumber: string;
  whatsappSameAsContact: boolean;
  whatsappCountryCode: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
};

export const initialPersonalDraft = (): PersonalDraft => ({
  interestedIn: 'both',
  fullName: '',
  email: '',
  mobileCountryCode: COUNTRY_CODES[0]!.code,
  mobileNumber: '',
  whatsappSameAsContact: true,
  whatsappCountryCode: COUNTRY_CODES[0]!.code,
  whatsappNumber: '',
  password: '',
  confirmPassword: '',
});

export function PersonalStep({
  value,
  onChange,
  onSubmit,
  busy,
  error,
}: {
  value: PersonalDraft;
  onChange: (next: PersonalDraft) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof PersonalDraft>(k: K, v: PersonalDraft[K]) =>
    onChange({ ...value, [k]: v });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (value.password !== value.confirmPassword) return;
    onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="interestedIn">
          Interested In <span className="text-destructive">*</span>
        </Label>
        <Select
          value={value.interestedIn}
          onValueChange={(v) => set('interestedIn', v as InterestedIn)}
        >
          <SelectTrigger id="interestedIn">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {INTERESTED_IN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">
          Full Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="fullName"
          value={value.fullName}
          onChange={(e) => set('fullName', e.target.value)}
          required
          maxLength={255}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={value.email}
          onChange={(e) => set('email', e.target.value)}
          required
        />
      </div>

      <MobileInput
        id="mobileNumber"
        label="Contact Number"
        countryCode={value.mobileCountryCode}
        number={value.mobileNumber}
        onCountryChange={(v) => {
          const next: PersonalDraft = { ...value, mobileCountryCode: v };
          if (next.whatsappSameAsContact) next.whatsappCountryCode = v;
          onChange(next);
        }}
        onNumberChange={(v) => {
          const next: PersonalDraft = { ...value, mobileNumber: v };
          if (next.whatsappSameAsContact) next.whatsappNumber = v;
          onChange(next);
        }}
      />

      <div className="flex items-center gap-2">
        <Checkbox
          id="whatsappSame"
          checked={value.whatsappSameAsContact}
          onCheckedChange={(checked) => {
            const same = checked === true;
            const next: PersonalDraft = { ...value, whatsappSameAsContact: same };
            if (same) {
              next.whatsappCountryCode = value.mobileCountryCode;
              next.whatsappNumber = value.mobileNumber;
            }
            onChange(next);
          }}
        />
        <Label htmlFor="whatsappSame" className="text-sm font-normal">
          Whatsapp number is same as contact number
        </Label>
      </div>

      {!value.whatsappSameAsContact && (
        <MobileInput
          id="whatsappNumber"
          label="Whatsapp Number"
          countryCode={value.whatsappCountryCode}
          number={value.whatsappNumber}
          onCountryChange={(v) => set('whatsappCountryCode', v)}
          onNumberChange={(v) => set('whatsappNumber', v)}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">
            Password <span className="text-destructive">*</span>
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={value.password}
            onChange={(e) => set('password', e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">
            Confirm Password <span className="text-destructive">*</span>
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={value.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            required
          />
          {touched && value.password !== value.confirmPassword && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Sending OTP…' : 'Save & Continue'}
      </Button>
    </form>
  );
}
