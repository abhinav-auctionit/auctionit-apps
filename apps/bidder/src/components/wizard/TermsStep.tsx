import { type FormEvent } from 'react';
import { Button, Checkbox, Input, Label } from '@auction/ui';

export type TermsDraft = {
  termsAccepted: boolean;
  signatoryName: string;
  signatoryDesignation: string;
  signatoryPlace: string;
  signatoryDate: string;
};

export const initialTermsDraft = (): TermsDraft => ({
  termsAccepted: false,
  signatoryName: '',
  signatoryDesignation: '',
  signatoryPlace: '',
  signatoryDate: new Date().toISOString().slice(0, 10),
});

export function TermsStep({
  value,
  onChange,
  onBack,
  onSubmit,
  busy,
  error,
}: {
  value: TermsDraft;
  onChange: (next: TermsDraft) => void;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  const set = <K extends keyof TermsDraft>(k: K, v: TermsDraft[K]) =>
    onChange({ ...value, [k]: v });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
        <p className="font-medium">Terms of Use</p>
        <p className="mt-2 text-muted-foreground">
          By proceeding, you confirm that the information provided is accurate, that you are
          authorized to act on behalf of the company listed, and that you agree to abide by the
          auction platform's terms, including non-disclosure of bid data and adherence to bid
          commitments. Bids placed on the platform are binding once approved.
        </p>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="termsAccepted"
          checked={value.termsAccepted}
          onCheckedChange={(c) => set('termsAccepted', c === true)}
        />
        <Label htmlFor="termsAccepted" className="text-sm font-normal">
          I/We understand and fully agree with the terms and conditions.
        </Label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signatoryName">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signatoryName"
            value={value.signatoryName}
            onChange={(e) => set('signatoryName', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signatoryDesignation">
            Designation <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signatoryDesignation"
            value={value.signatoryDesignation}
            onChange={(e) => set('signatoryDesignation', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signatoryPlace">
            Place <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signatoryPlace"
            value={value.signatoryPlace}
            onChange={(e) => set('signatoryPlace', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signatoryDate">
            Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signatoryDate"
            type="date"
            value={value.signatoryDate}
            onChange={(e) => set('signatoryDate', e.target.value)}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={busy || !value.termsAccepted}>
          {busy ? 'Saving…' : 'Save & Continue'}
        </Button>
      </div>
    </form>
  );
}
