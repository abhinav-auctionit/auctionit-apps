import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, type StoredFile } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import { clientCreateSchema, type ClientCreateInput } from '@auction/types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const STEPS = [
  { id: 1, title: 'Company' },
  { id: 2, title: 'Tax & Status' },
  { id: 3, title: 'Auction Config' },
  { id: 4, title: 'Charges & Revenue' },
  { id: 5, title: 'Terms & Display' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

type FormState = {
  // Step 1
  companyName: string;
  phone: string;
  websiteUrl: string;
  registeredAddress: string;
  country: '' | 'India' | 'UAE';
  // Step 2
  pan: string;
  tan: string;
  tin: string;
  isActive: 'yes' | 'no';
  // Step 3
  prefixAuctionCode: string;
  suffixAuctionCode: string;
  autoExtend: '' | 'yes' | 'no';
  extendIfLastBidSec: string;
  extendDurationSec: string;
  extensionMaxTimes: string;
  staggeringOfLots: '' | 'none' | 'all_lots' | 'subsequent_lots';
  staggeringOfLotsDurationSec: string;
  staggeringOfAuction: '' | 'yes' | 'no';
  staggeringOfAuctionDurationSec: string;
  // Step 4
  otherChargeType: '' | 'flat' | 'percentage';
  otherChargeAmount: string;
  revenueRate: string;
  plantTechPersonDetails: string;
  // Step 5
  displayMaterialLocation: boolean;
  displayPlantLocation: boolean;
  allowsConsolidatedEmd: boolean;
  tncFile: StoredFile | null;
};

const initialState = (): FormState => ({
  companyName: '',
  phone: '',
  websiteUrl: '',
  registeredAddress: '',
  country: '',
  pan: '',
  tan: '',
  tin: '',
  isActive: 'yes',
  prefixAuctionCode: '',
  suffixAuctionCode: '',
  autoExtend: '',
  extendIfLastBidSec: '',
  extendDurationSec: '',
  extensionMaxTimes: '',
  staggeringOfLots: '',
  staggeringOfLotsDurationSec: '',
  staggeringOfAuction: '',
  staggeringOfAuctionDurationSec: '',
  otherChargeType: '',
  otherChargeAmount: '',
  revenueRate: '',
  plantTechPersonDetails: '',
  displayMaterialLocation: false,
  displayPlantLocation: false,
  allowsConsolidatedEmd: false,
  tncFile: null,
});

const intOrNull = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
};

const buildPayload = (s: FormState): unknown => ({
  companyName: s.companyName,
  phone: s.phone || undefined,
  websiteUrl: s.websiteUrl || undefined,
  registeredAddress: s.registeredAddress,
  country: s.country || undefined,
  pan: s.pan,
  tan: s.tan,
  tin: s.tin,
  isActive: s.isActive === 'yes',
  prefixAuctionCode: s.prefixAuctionCode || undefined,
  suffixAuctionCode: s.suffixAuctionCode || undefined,
  autoExtend: s.autoExtend === 'yes',
  extendIfLastBidSec: s.autoExtend === 'yes' ? intOrNull(s.extendIfLastBidSec) : null,
  extendDurationSec: s.autoExtend === 'yes' ? intOrNull(s.extendDurationSec) : null,
  extensionMaxTimes: s.autoExtend === 'yes' ? intOrNull(s.extensionMaxTimes) : null,
  staggeringOfLots: s.staggeringOfLots || null,
  staggeringOfLotsDurationSec:
    s.staggeringOfLots && s.staggeringOfLots !== 'none'
      ? intOrNull(s.staggeringOfLotsDurationSec)
      : null,
  staggeringOfAuction:
    s.staggeringOfAuction === '' ? null : s.staggeringOfAuction === 'yes',
  staggeringOfAuctionDurationSec:
    s.staggeringOfAuction === 'yes'
      ? intOrNull(s.staggeringOfAuctionDurationSec)
      : null,
  otherChargeType: s.otherChargeType || null,
  otherChargeAmount: s.otherChargeType ? intOrNull(s.otherChargeAmount) : null,
  revenueRate: intOrNull(s.revenueRate),
  plantTechPersonDetails: s.plantTechPersonDetails || undefined,
  displayMaterialLocation: s.displayMaterialLocation,
  displayPlantLocation: s.displayPlantLocation,
  allowsConsolidatedEmd: s.allowsConsolidatedEmd,
  tncFileId: s.tncFile?.id ?? null,
});

export function NewClientPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState<StepId>(1);
  const [s, setS] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const create = useMutation({
    mutationFn: (input: ClientCreateInput) => api.adminClients.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'clients'] });
      navigate('/clients');
    },
  });

  const validateStep = (id: StepId): boolean => {
    const errs: Record<string, string> = {};
    if (id === 1) {
      if (!s.companyName.trim()) errs.companyName = 'required';
      if (!s.registeredAddress.trim()) errs.registeredAddress = 'required';
      if (!s.country) errs.country = 'required';
    }
    if (id === 2) {
      if (!s.pan.trim()) errs.pan = 'required';
      if (!s.tan.trim()) errs.tan = 'required';
      if (!s.tin.trim()) errs.tin = 'required';
    }
    if (id === 3 && s.autoExtend === 'yes') {
      if (!s.extendIfLastBidSec) errs.extendIfLastBidSec = 'required';
      if (!s.extendDurationSec) errs.extendDurationSec = 'required';
      if (!s.extensionMaxTimes) errs.extensionMaxTimes = 'required';
      if (s.staggeringOfLots && s.staggeringOfLots !== 'none' && !s.staggeringOfLotsDurationSec)
        errs.staggeringOfLotsDurationSec = 'required';
      if (s.staggeringOfAuction === 'yes' && !s.staggeringOfAuctionDurationSec)
        errs.staggeringOfAuctionDurationSec = 'required';
    }
    if (id === 4) {
      if (!s.revenueRate) errs.revenueRate = 'required';
      if (s.otherChargeType && !s.otherChargeAmount)
        errs.otherChargeAmount = 'required when type is set';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep((step + 1) as StepId);
  };
  const back = () => setStep(((step - 1) as StepId) || 1);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep(5)) return;
    const payload = buildPayload(s);
    const parsed = clientCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (path) errs[path] = issue.message;
      }
      setErrors(errs);
      // Jump to the earliest step with errors
      if (
        ['companyName', 'registeredAddress', 'country', 'phone', 'websiteUrl'].some((k) => errs[k])
      )
        setStep(1);
      else if (['pan', 'tan', 'tin'].some((k) => errs[k])) setStep(2);
      else if (
        [
          'autoExtend',
          'extendIfLastBidSec',
          'extendDurationSec',
          'extensionMaxTimes',
          'staggeringOfLots',
          'staggeringOfLotsDurationSec',
          'staggeringOfAuction',
          'staggeringOfAuctionDurationSec',
          'prefixAuctionCode',
          'suffixAuctionCode',
        ].some((k) => errs[k])
      )
        setStep(3);
      else if (
        ['otherChargeType', 'otherChargeAmount', 'revenueRate', 'plantTechPersonDetails'].some(
          (k) => errs[k],
        )
      )
        setStep(4);
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">New client</h1>
          <p className="text-sm text-muted-foreground">
            Onboard a seller. All five steps are required; conditional fields appear based on
            your auction-extension choices.
          </p>
        </div>

        <StepIndicator current={step} />

        <form onSubmit={submit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{STEPS[step - 1]!.title}</CardTitle>
              <CardDescription>{stepDescription(step)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 1 && <CompanyStep s={s} set={set} errors={errors} />}
              {step === 2 && <TaxStep s={s} set={set} errors={errors} />}
              {step === 3 && <AuctionStep s={s} set={set} errors={errors} />}
              {step === 4 && <ChargesStep s={s} set={set} errors={errors} />}
              {step === 5 && <TermsStep s={s} set={set} errors={errors} />}
            </CardContent>
          </Card>

          {create.error && (
            <p className="mt-3 text-sm text-destructive">
              {create.error instanceof ApiError ? create.error.message : 'Failed to create'}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={back}
              disabled={step === 1 || create.isPending}
            >
              Back
            </Button>
            {step < STEPS.length ? (
              <Button type="button" onClick={next}>
                Save & continue
              </Button>
            ) : (
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create client'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function stepDescription(step: StepId): string {
  switch (step) {
    case 1:
      return "Basic company info — name, address, and country.";
    case 2:
      return 'Tax identifiers and account status.';
    case 3:
      return 'Auction code prefixes and bid-extension behavior.';
    case 4:
      return 'Other charges (optional) and the platform revenue rate.';
    case 5:
      return 'Display preferences and the signed Terms & Conditions document.';
  }
}

function StepIndicator({ current }: { current: StepId }) {
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((step) => {
        const state = step.id < current ? 'done' : step.id === current ? 'active' : 'upcoming';
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium',
                state === 'done' && 'border-primary bg-primary text-primary-foreground',
                state === 'active' && 'border-primary text-primary',
                state === 'upcoming' && 'border-muted text-muted-foreground',
              )}
            >
              {step.id}
            </span>
            <span
              className={cn(
                state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {step.title}
            </span>
            {step.id < STEPS.length && (
              <span
                className={cn(
                  'mx-2 hidden h-px flex-1 sm:block',
                  state === 'done' ? 'bg-primary' : 'bg-muted',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ----- Step components ----------------------------------------------------

type StepProps = {
  s: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Record<string, string>;
};

function ErrorText({ id, errors }: { id: string; errors: Record<string, string> }) {
  if (!errors[id]) return null;
  return <p className="text-xs text-destructive">{errors[id]}</p>;
}

function CompanyStep({ s, set, errors }: StepProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="companyName">
          Company name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="companyName"
          maxLength={100}
          value={s.companyName}
          onChange={(e) => set('companyName', e.target.value)}
        />
        <ErrorText id="companyName" errors={errors} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          maxLength={20}
          value={s.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="websiteUrl">Website URL</Label>
        <Input
          id="websiteUrl"
          maxLength={100}
          value={s.websiteUrl}
          onChange={(e) => set('websiteUrl', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">
          Country <span className="text-destructive">*</span>
        </Label>
        <Select
          value={s.country}
          onValueChange={(v) => set('country', v as FormState['country'])}
        >
          <SelectTrigger id="country">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="India">India</SelectItem>
            <SelectItem value="UAE">UAE</SelectItem>
          </SelectContent>
        </Select>
        <ErrorText id="country" errors={errors} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="registeredAddress">
          Registered address <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="registeredAddress"
          maxLength={500}
          rows={3}
          value={s.registeredAddress}
          onChange={(e) => set('registeredAddress', e.target.value)}
        />
        <ErrorText id="registeredAddress" errors={errors} />
      </div>
    </div>
  );
}

function TaxStep({ s, set, errors }: StepProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="pan">
          PAN <span className="text-destructive">*</span>
        </Label>
        <Input
          id="pan"
          maxLength={10}
          value={s.pan}
          onChange={(e) => set('pan', e.target.value.toUpperCase())}
        />
        <ErrorText id="pan" errors={errors} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tan">
          TAN <span className="text-destructive">*</span>
        </Label>
        <Input
          id="tan"
          maxLength={10}
          value={s.tan}
          onChange={(e) => set('tan', e.target.value.toUpperCase())}
        />
        <ErrorText id="tan" errors={errors} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tin">
          TIN <span className="text-destructive">*</span>
        </Label>
        <Input
          id="tin"
          maxLength={15}
          value={s.tin}
          onChange={(e) => set('tin', e.target.value.toUpperCase())}
        />
        <ErrorText id="tin" errors={errors} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="isActive">Is active</Label>
        <Select value={s.isActive} onValueChange={(v) => set('isActive', v as 'yes' | 'no')}>
          <SelectTrigger id="isActive">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AuctionStep({ s, set, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="prefixAuctionCode">Prefix auction code</Label>
          <Input
            id="prefixAuctionCode"
            maxLength={25}
            value={s.prefixAuctionCode}
            onChange={(e) => set('prefixAuctionCode', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="suffixAuctionCode">Suffix auction code</Label>
          <Input
            id="suffixAuctionCode"
            maxLength={25}
            value={s.suffixAuctionCode}
            onChange={(e) => set('suffixAuctionCode', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="autoExtend">Auto extend</Label>
        <Select
          value={s.autoExtend}
          onValueChange={(v) => set('autoExtend', v as FormState['autoExtend'])}
        >
          <SelectTrigger id="autoExtend">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {s.autoExtend === 'yes' && (
        <div className="space-y-4 rounded-md border bg-muted/30 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <NumField
              id="extendIfLastBidSec"
              label="Extend if last bid (sec)"
              required
              value={s.extendIfLastBidSec}
              onChange={(v) => set('extendIfLastBidSec', v)}
              errors={errors}
            />
            <NumField
              id="extendDurationSec"
              label="Extend duration (sec)"
              required
              value={s.extendDurationSec}
              onChange={(v) => set('extendDurationSec', v)}
              errors={errors}
            />
            <NumField
              id="extensionMaxTimes"
              label="Extension count"
              required
              value={s.extensionMaxTimes}
              onChange={(v) => set('extensionMaxTimes', v)}
              errors={errors}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staggeringOfLots">Staggering of lots</Label>
              <Select
                value={s.staggeringOfLots}
                onValueChange={(v) =>
                  set('staggeringOfLots', v as FormState['staggeringOfLots'])
                }
              >
                <SelectTrigger id="staggeringOfLots">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="all_lots">All lots</SelectItem>
                  <SelectItem value="subsequent_lots">Subsequent lots</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {s.staggeringOfLots && s.staggeringOfLots !== 'none' && (
              <NumField
                id="staggeringOfLotsDurationSec"
                label="Staggering of lots duration (sec)"
                required
                value={s.staggeringOfLotsDurationSec}
                onChange={(v) => set('staggeringOfLotsDurationSec', v)}
                errors={errors}
              />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staggeringOfAuction">Staggering of auction</Label>
              <Select
                value={s.staggeringOfAuction}
                onValueChange={(v) =>
                  set('staggeringOfAuction', v as FormState['staggeringOfAuction'])
                }
              >
                <SelectTrigger id="staggeringOfAuction">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {s.staggeringOfAuction === 'yes' && (
              <NumField
                id="staggeringOfAuctionDurationSec"
                label="Staggering of auction duration (sec)"
                required
                value={s.staggeringOfAuctionDurationSec}
                onChange={(v) => set('staggeringOfAuctionDurationSec', v)}
                errors={errors}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChargesStep({ s, set, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="otherChargeType">Other charge type</Label>
          <Select
            value={s.otherChargeType}
            onValueChange={(v) =>
              set('otherChargeType', v as FormState['otherChargeType'])
            }
          >
            <SelectTrigger id="otherChargeType">
              <SelectValue placeholder="Select (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Flat</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {s.otherChargeType && (
          <NumField
            id="otherChargeAmount"
            label={
              s.otherChargeType === 'percentage'
                ? 'Other charge amount (%)'
                : 'Other charge amount (₹)'
            }
            value={s.otherChargeAmount}
            onChange={(v) => set('otherChargeAmount', v)}
            errors={errors}
          />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <NumField
          id="revenueRate"
          label="Revenue rate"
          required
          value={s.revenueRate}
          onChange={(v) => set('revenueRate', v)}
          errors={errors}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plantTechPersonDetails">Plant tech person details</Label>
        <Input
          id="plantTechPersonDetails"
          maxLength={200}
          value={s.plantTechPersonDetails}
          onChange={(e) => set('plantTechPersonDetails', e.target.value)}
        />
      </div>
    </div>
  );
}

function TermsStep({ s, set, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={s.displayMaterialLocation}
            onCheckedChange={(c) => set('displayMaterialLocation', c === true)}
          />
          <span className="text-sm">Display material location</span>
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={s.displayPlantLocation}
            onCheckedChange={(c) => set('displayPlantLocation', c === true)}
          />
          <span className="text-sm">Display plant location</span>
        </label>
      </div>

      <div className="rounded-md border border-muted p-3">
        <label className="flex items-start gap-2">
          <Checkbox
            checked={s.allowsConsolidatedEmd}
            onCheckedChange={(c) => set('allowsConsolidatedEmd', c === true)}
          />
          <div>
            <span className="text-sm font-medium">Allow consolidated EMD</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When enabled, this client's auctions can offer a consolidated EMD option
              alongside lot-level EMD. Individual bidders can choose either mode at
              attach time.
            </p>
          </div>
        </label>
      </div>

      <TncUpload
        current={s.tncFile}
        onUpload={(f) => set('tncFile', f)}
        errors={errors}
      />
    </div>
  );
}

function NumField({
  id,
  label,
  required,
  value,
  onChange,
  errors,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <ErrorText id={id} errors={errors} />
    </div>
  );
}

function TncUpload({
  current,
  onUpload,
  errors,
}: {
  current: StoredFile | null;
  onUpload: (f: StoredFile | null) => void;
  errors: Record<string, string>;
}) {
  const api = useApiClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const stored = await api.files.upload(file);
      onUpload(stored);
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="tnc">Terms & conditions</Label>
      <input
        id="tnc"
        ref={inputRef}
        type="file"
        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
        onChange={handle}
        disabled={busy}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-secondary/80"
      />
      {current && (
        <p className="text-xs text-muted-foreground">
          Uploaded: <strong>{current.originalName}</strong> (
          {Math.round(current.sizeBytes / 1024)} KB)
        </p>
      )}
      {busy && <p className="text-xs text-muted-foreground">Uploading…</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
      <ErrorText id="tncFileId" errors={errors} />
    </div>
  );
}
