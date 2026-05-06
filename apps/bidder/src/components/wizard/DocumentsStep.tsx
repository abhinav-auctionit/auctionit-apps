import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, Input, Label } from '@auction/ui';
import { useApiClient } from '@auction/auth';
import { ApiError, type StoredFile } from '@auction/api-client';
import { ACCEPT_FILE_TYPES } from '../../lib/wizard';

export type DocumentsDraft = {
  panCardFile: StoredFile | null;
  proofOfAddressFile: StoredFile | null;
  cancelledChequeFile: StoredFile | null;
  otherFile: StoredFile | null;
  bankAccountNumber: string;
  bankName: string;
  ifscCode: string;
};

export const initialDocumentsDraft = (): DocumentsDraft => ({
  panCardFile: null,
  proofOfAddressFile: null,
  cancelledChequeFile: null,
  otherFile: null,
  bankAccountNumber: '',
  bankName: '',
  ifscCode: '',
});

const DOC_FIELDS = [
  { key: 'panCardFile', label: 'PAN Card', required: true },
  { key: 'proofOfAddressFile', label: 'Proof of Address', required: true },
  { key: 'cancelledChequeFile', label: 'Cancelled Cheque', required: true },
  { key: 'otherFile', label: 'Other', required: false },
] as const;

function FileSlot({
  field,
  label,
  required,
  current,
  onUpload,
}: {
  field: keyof DocumentsDraft;
  label: string;
  required: boolean;
  current: StoredFile | null;
  onUpload: (file: StoredFile) => void;
}) {
  const api = useApiClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const stored = await api.files.upload(file);
      onUpload(stored);
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <input
        id={field}
        ref={inputRef}
        type="file"
        accept={ACCEPT_FILE_TYPES}
        onChange={handle}
        disabled={busy}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-secondary/80"
      />
      {current && (
        <p className="text-xs text-muted-foreground">
          Uploaded: {current.originalName} ({Math.round(current.sizeBytes / 1024)} KB)
        </p>
      )}
      {busy && <p className="text-xs text-muted-foreground">Uploading…</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

export function DocumentsStep({
  value,
  onChange,
  onBack,
  onSubmit,
  busy,
  error,
}: {
  value: DocumentsDraft;
  onChange: (next: DocumentsDraft) => void;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  const set = <K extends keyof DocumentsDraft>(k: K, v: DocumentsDraft[K]) =>
    onChange({ ...value, [k]: v });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-muted-foreground">
        Accepted formats: jpg, jpeg, png, gif, pdf, doc, docx. Max 10 MB each.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {DOC_FIELDS.map((f) => (
          <FileSlot
            key={f.key}
            field={f.key}
            label={f.label}
            required={f.required}
            current={value[f.key] as StoredFile | null}
            onUpload={(stored) => set(f.key as keyof DocumentsDraft, stored as never)}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="bankAccountNumber">
            Account Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="bankAccountNumber"
            value={value.bankAccountNumber}
            onChange={(e) => set('bankAccountNumber', e.target.value)}
            required
            maxLength={64}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankName">
            Bank Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="bankName"
            value={value.bankName}
            onChange={(e) => set('bankName', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ifscCode">
            IFSC Code <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ifscCode"
            value={value.ifscCode}
            onChange={(e) => set('ifscCode', e.target.value.toUpperCase())}
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
