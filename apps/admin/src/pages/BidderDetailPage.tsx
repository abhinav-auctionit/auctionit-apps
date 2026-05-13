import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type BidderProfileDetail, type StoredFile } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';
import { BidderWalletSection } from '../components/BidderWalletSection';

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Action failed';

const TABS = ['details', 'wallet'] as const;
type TabId = (typeof TABS)[number];
const isTabId = (v: string | null): v is TabId =>
  !!v && (TABS as readonly string[]).includes(v);

export function BidderDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const api = useApiClient();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = isTabId(tabParam) ? tabParam : 'details';

  const detail = useQuery({
    queryKey: ['admin', 'bidder-profile', id],
    queryFn: () => api.adminBidders.get(id),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'bidder-profile', id] });
    qc.invalidateQueries({ queryKey: ['admin', 'bidder-profiles'] });
  };

  const markPaid = useMutation({
    mutationFn: (note: string) => api.adminBidders.markFeePaid(id, { note: note || undefined }),
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: () => api.adminBidders.approve(id),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (note: string) => api.adminBidders.reject(id, { note }),
    onSuccess: invalidate,
  });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [paidNote, setPaidNote] = useState('');
  const [paidOpen, setPaidOpen] = useState(false);

  if (detail.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <AppShell>
        <p className="text-sm text-destructive">
          {detail.error instanceof ApiError ? detail.error.message : 'Failed to load profile'}
        </p>
        <Link to="/bidders" className="text-sm text-primary underline">
          ← Back
        </Link>
      </AppShell>
    );
  }

  const p = detail.data;
  const fee = p.registrationFeePaid;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{p.fullName ?? p.user.name}</h1>
            <p className="text-sm text-muted-foreground">
              {p.user.email}
              {p.user.mobileCountryCode && p.user.mobileNumber
                ? ` · ${p.user.mobileCountryCode} ${p.user.mobileNumber}`
                : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <StatusBadges profile={p} />
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const next = new URLSearchParams(searchParams);
            if (v === 'details') next.delete('tab');
            else next.set('tab', v);
            setSearchParams(next, { replace: true });
          }}
        >
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Section title="Personal">
                  <Field label="Interested In" value={p.interestedIn ?? '—'} />
                  <Field label="Full Name" value={p.fullName ?? '—'} />
                  <Field
                    label="Contact"
                    value={
                      p.contactCountryCode && p.contactNumber
                        ? `${p.contactCountryCode} ${p.contactNumber}`
                        : '—'
                    }
                  />
                  <Field
                    label="Whatsapp"
                    value={
                      p.whatsappCountryCode && p.whatsappNumber
                        ? `${p.whatsappCountryCode} ${p.whatsappNumber}`
                        : '—'
                    }
                  />
                </Section>

                <Section title="Company">
                  <Field label="Company Name" value={p.companyName ?? '—'} />
                  <Field label="Type" value={p.companyType ?? '—'} />
                  <Field label="Business Activity" value={p.businessActivity ?? '—'} />
                  <Field label="GST" value={p.gst ?? '—'} />
                  <Field label="PAN" value={p.pan ?? '—'} />
                  <Field label="Designation" value={p.designation ?? '—'} />
                  <Field label="Registered Email" value={p.registeredEmail ?? '—'} />
                  <Field label="Secondary Number" value={p.secondaryNumber ?? '—'} />
                </Section>

                <Section title="Address" full>
                  <Field label="Address" value={p.address ?? '—'} />
                  <Field
                    label="City / State / Country"
                    value={[p.city, p.state, p.country].filter(Boolean).join(', ') || '—'}
                  />
                  <Field label="PIN Code" value={p.pinCode ?? '—'} />
                </Section>

                <Section title="Documents">
                  <FileLink label="PAN Card" file={p.panCardFile} />
                  <FileLink label="Proof of Address" file={p.proofOfAddressFile} />
                  <FileLink label="Cancelled Cheque" file={p.cancelledChequeFile} />
                  <FileLink label="Other" file={p.otherFile} />
                </Section>

                <Section title="Bank">
                  <Field label="Account Number" value={p.bankAccountNumber ?? '—'} />
                  <Field label="Bank Name" value={p.bankName ?? '—'} />
                  <Field label="IFSC" value={p.ifscCode ?? '—'} />
                </Section>

                <Section title="Terms">
                  <Field
                    label="Accepted At"
                    value={p.termsAcceptedAt ? new Date(p.termsAcceptedAt).toLocaleString() : '—'}
                  />
                  <Field label="Signatory" value={p.signatoryName ?? '—'} />
                  <Field label="Designation" value={p.signatoryDesignation ?? '—'} />
                  <Field label="Place" value={p.signatoryPlace ?? '—'} />
                  <Field
                    label="Date"
                    value={p.signatoryDate ? new Date(p.signatoryDate).toLocaleDateString() : '—'}
                  />
                </Section>

                <Section title="Subscription & Fee">
                  <Field label="Subscription" value={p.subscriptionType ?? '—'} />
                  <Field
                    label="Fee Status"
                    value={
                      fee
                        ? `Paid${
                            p.registrationFeePaidAt
                              ? ` on ${new Date(p.registrationFeePaidAt).toLocaleDateString()}`
                              : ''
                          }`
                        : 'Unpaid'
                    }
                  />
                  {p.registrationFeeNote && (
                    <Field label="Fee Note" value={p.registrationFeeNote} />
                  )}
                </Section>

                <Section title="Workflow">
                  <Field label="Status" value={p.status} />
                  <Field
                    label="Submitted"
                    value={p.submittedAt ? new Date(p.submittedAt).toLocaleString() : '—'}
                  />
                  <Field
                    label="Approved"
                    value={p.approvedAt ? new Date(p.approvedAt).toLocaleString() : '—'}
                  />
                  <Field
                    label="Rejected"
                    value={p.rejectedAt ? new Date(p.rejectedAt).toLocaleString() : '—'}
                  />
                  {p.rejectionNote && <Field label="Rejection Note" value={p.rejectionNote} />}
                </Section>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={fee || markPaid.isPending}
                    onClick={() => setPaidOpen(true)}
                  >
                    {fee ? 'Fee already paid' : 'Mark fee paid'}
                  </Button>
                  <Button
                    disabled={
                      approve.isPending ||
                      p.status === 'approved' ||
                      p.status !== 'pending_approval' ||
                      !fee
                    }
                    onClick={() => approve.mutate()}
                  >
                    {approve.isPending ? 'Approving…' : 'Approve'}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={reject.isPending || p.status === 'approved'}
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject
                  </Button>
                </CardContent>
                {(markPaid.error || approve.error || reject.error) && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-destructive">
                      {errMsg(markPaid.error ?? approve.error ?? reject.error)}
                    </p>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="wallet" className="mt-6">
            <BidderWalletSection profileId={p.id} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark registration fee paid</DialogTitle>
            <DialogDescription>
              Confirm offline receipt of the fee. Optional note (e.g., NEFT reference).
            </DialogDescription>
          </DialogHeader>
          <NoteForm
            label="Note (optional)"
            value={paidNote}
            onChange={setPaidNote}
            submitLabel={markPaid.isPending ? 'Saving…' : 'Mark paid'}
            disabled={markPaid.isPending}
            onSubmit={async () => {
              await markPaid.mutateAsync(paidNote);
              setPaidOpen(false);
              setPaidNote('');
            }}
            onCancel={() => setPaidOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject application</DialogTitle>
            <DialogDescription>
              Provide a note describing what the bidder needs to fix. They'll see this on their
              profile.
            </DialogDescription>
          </DialogHeader>
          <NoteForm
            label="Reason (required)"
            value={rejectNote}
            onChange={setRejectNote}
            required
            submitLabel={reject.isPending ? 'Rejecting…' : 'Reject'}
            disabled={reject.isPending || rejectNote.trim().length === 0}
            destructive
            onSubmit={async () => {
              await reject.mutateAsync(rejectNote);
              setRejectOpen(false);
              setRejectNote('');
            }}
            onCancel={() => setRejectOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatusBadges({ profile }: { profile: BidderProfileDetail }) {
  return (
    <div className="flex gap-2">
      <Badge variant={profile.status === 'approved' ? 'default' : 'secondary'}>
        {profile.status}
      </Badge>
      <Badge variant={profile.registrationFeePaid ? 'default' : 'outline'}>
        {profile.registrationFeePaid ? 'Fee paid' : 'Fee unpaid'}
      </Badge>
    </div>
  );
}

function Section({
  title,
  children,
  full = false,
}: {
  title: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <Card className={full ? 'md:col-span-2' : ''}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 font-medium">{value}</span>
    </div>
  );
}

function FileLink({ label, file }: { label: string; file: StoredFile | null }) {
  const api = useApiClient();
  if (!file) {
    return (
      <div className="grid grid-cols-3 gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="col-span-2 text-muted-foreground">—</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <a
        className="col-span-2 truncate text-primary underline"
        href={api.files.contentUrl(file.id)}
        target="_blank"
        rel="noreferrer"
      >
        {file.originalName}
      </a>
    </div>
  );
}

function NoteForm({
  label,
  value,
  onChange,
  required = false,
  submitLabel,
  disabled,
  destructive,
  onSubmit,
  onCancel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  submitLabel: string;
  disabled?: boolean;
  destructive?: boolean;
  onSubmit: () => Promise<void> | void;
  onCancel: () => void;
}) {
  async function handle(e: FormEvent) {
    e.preventDefault();
    await onSubmit();
  }
  return (
    <form className="space-y-4" onSubmit={handle}>
      <div className="space-y-2">
        <Label htmlFor="note">{label}</Label>
        <Textarea
          id="note"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          required={required}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={destructive ? 'destructive' : 'default'}
          disabled={disabled}
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
