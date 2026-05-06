import { type FormEvent } from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@auction/ui';
import type { BidderCountry, BusinessActivity, CompanyType } from '@auction/types';
import type { CountriesResponse } from '@auction/api-client';
import {
  BUSINESS_ACTIVITY_OPTIONS,
  COMPANY_TYPE_OPTIONS,
} from '../../lib/wizard';

export type CompanyDraft = {
  companyName: string;
  companyType: CompanyType | '';
  businessActivity: BusinessActivity | '';
  address: string;
  country: BidderCountry | '';
  state: string;
  city: string;
  pinCode: string;
  designation: string;
  secondaryNumber: string;
  registeredEmail: string;
  gst: string;
  pan: string;
};

export const initialCompanyDraft = (): CompanyDraft => ({
  companyName: '',
  companyType: '',
  businessActivity: '',
  address: '',
  country: '',
  state: '',
  city: '',
  pinCode: '',
  designation: '',
  secondaryNumber: '',
  registeredEmail: '',
  gst: '',
  pan: '',
});

export function CompanyStep({
  value,
  onChange,
  countries,
  onBack,
  onSubmit,
  busy,
  error,
}: {
  value: CompanyDraft;
  onChange: (next: CompanyDraft) => void;
  countries: CountriesResponse | undefined;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  const set = <K extends keyof CompanyDraft>(k: K, v: CompanyDraft[K]) =>
    onChange({ ...value, [k]: v });

  const states: readonly string[] =
    value.country && countries ? countries[value.country as BidderCountry] ?? [] : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyName">
            Company Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="companyName"
            value={value.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyType">
            Type of Company <span className="text-destructive">*</span>
          </Label>
          <Select
            value={value.companyType}
            onValueChange={(v) => set('companyType', v as CompanyType)}
          >
            <SelectTrigger id="companyType">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessActivity">
          Business Activity <span className="text-destructive">*</span>
        </Label>
        <Select
          value={value.businessActivity}
          onValueChange={(v) => set('businessActivity', v as BusinessActivity)}
        >
          <SelectTrigger id="businessActivity">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_ACTIVITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">
          Address <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="address"
          value={value.address}
          onChange={(e) => set('address', e.target.value)}
          required
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country">
            Country <span className="text-destructive">*</span>
          </Label>
          <Select
            value={value.country}
            onValueChange={(v) => onChange({ ...value, country: v as BidderCountry, state: '' })}
          >
            <SelectTrigger id="country">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries &&
                Object.keys(countries).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">
            State <span className="text-destructive">*</span>
          </Label>
          <Select
            value={value.state}
            onValueChange={(v) => set('state', v)}
            disabled={!value.country || states.length === 0}
          >
            <SelectTrigger id="state">
              <SelectValue placeholder={value.country ? 'Select state' : 'Pick a country first'} />
            </SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">
            City <span className="text-destructive">*</span>
          </Label>
          <Input id="city" value={value.city} onChange={(e) => set('city', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pinCode">
            PIN Code <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pinCode"
            value={value.pinCode}
            onChange={(e) => set('pinCode', e.target.value)}
            required
            maxLength={16}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="designation">
            Designation <span className="text-destructive">*</span>
          </Label>
          <Input
            id="designation"
            value={value.designation}
            onChange={(e) => set('designation', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secondaryNumber">Secondary Number</Label>
          <Input
            id="secondaryNumber"
            inputMode="tel"
            value={value.secondaryNumber}
            onChange={(e) => set('secondaryNumber', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="registeredEmail">
          Registered Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="registeredEmail"
          type="email"
          value={value.registeredEmail}
          onChange={(e) => set('registeredEmail', e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gst">
            GST <span className="text-destructive">*</span>
          </Label>
          <Input
            id="gst"
            value={value.gst}
            onChange={(e) => set('gst', e.target.value.toUpperCase())}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pan">
            PAN <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pan"
            value={value.pan}
            onChange={(e) => set('pan', e.target.value.toUpperCase())}
            required
            maxLength={16}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save & Continue'}
        </Button>
      </div>
    </form>
  );
}
