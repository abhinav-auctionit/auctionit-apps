import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError, type StoredFile } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const STAGGERING_LABEL: Record<string, string> = {
  none: 'None',
  all_lots: 'All lots',
  subsequent_lots: 'Subsequent lots',
};

export function ClientDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const api = useApiClient();

  const detail = useQuery({
    queryKey: ['admin', 'client', id],
    queryFn: () => api.adminClients.get(id),
    enabled: !!id,
  });

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
        <div className="space-y-4">
          <Link to="/clients" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to clients
          </Link>
          <p className="text-sm text-destructive">
            {detail.error instanceof ApiError ? detail.error.message : 'Failed to load client'}
          </p>
        </div>
      </AppShell>
    );
  }

  const c = detail.data;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <Link
            to="/clients"
            className="inline-block text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to clients
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{c.companyName}</h1>
              <p className="text-sm text-muted-foreground">
                {c.country} · onboarded {new Date(c.createdAt).toLocaleDateString()}
              </p>
            </div>
            {c.isActive ? (
              <Badge variant="default">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Company">
            <Field label="Company name" value={c.companyName} />
            <Field label="Phone" value={c.phone ?? '—'} />
            <Field
              label="Website"
              value={
                c.websiteUrl ? (
                  <a
                    href={absoluteUrl(c.websiteUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {c.websiteUrl}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <Field label="Country" value={c.country} />
            <Field label="Registered address" value={c.registeredAddress} />
          </Section>

          <Section title="Tax & Status">
            <Field label="PAN" value={<code className="font-mono text-xs">{c.pan}</code>} />
            <Field label="TAN" value={<code className="font-mono text-xs">{c.tan}</code>} />
            <Field label="TIN" value={<code className="font-mono text-xs">{c.tin}</code>} />
            <Field label="Active" value={c.isActive ? 'Yes' : 'No'} />
          </Section>

          <Section title="Auction Codes">
            <Field label="Prefix" value={c.prefixAuctionCode ?? '—'} />
            <Field label="Suffix" value={c.suffixAuctionCode ?? '—'} />
          </Section>

          <Section title="Auto Extend">
            <Field label="Enabled" value={c.autoExtend ? 'Yes' : 'No'} />
            {c.autoExtend && (
              <>
                <Field
                  label="Extend if last bid"
                  value={c.extendIfLastBidSec != null ? `${c.extendIfLastBidSec} sec` : '—'}
                />
                <Field
                  label="Extend duration"
                  value={c.extendDurationSec != null ? `${c.extendDurationSec} sec` : '—'}
                />
                <Field
                  label="Extension count"
                  value={c.extensionMaxTimes != null ? String(c.extensionMaxTimes) : '—'}
                />
              </>
            )}
          </Section>

          <Section title="Staggering">
            <Field
              label="Lots"
              value={
                c.staggeringOfLots ? STAGGERING_LABEL[c.staggeringOfLots] ?? c.staggeringOfLots : '—'
              }
            />
            {c.staggeringOfLots && c.staggeringOfLots !== 'none' && (
              <Field
                label="Lot duration"
                value={
                  c.staggeringOfLotsDurationSec != null
                    ? `${c.staggeringOfLotsDurationSec} sec`
                    : '—'
                }
              />
            )}
            <Field
              label="Auction"
              value={
                c.staggeringOfAuction == null ? '—' : c.staggeringOfAuction ? 'Yes' : 'No'
              }
            />
            {c.staggeringOfAuction && (
              <Field
                label="Auction duration"
                value={
                  c.staggeringOfAuctionDurationSec != null
                    ? `${c.staggeringOfAuctionDurationSec} sec`
                    : '—'
                }
              />
            )}
          </Section>

          <Section title="Charges & Revenue">
            <Field
              label="Other charge"
              value={
                c.otherChargeType
                  ? c.otherChargeType === 'percentage'
                    ? `${c.otherChargeAmount ?? 0}%`
                    : inr.format(c.otherChargeAmount ?? 0)
                  : '—'
              }
            />
            <Field label="Revenue rate" value={inr.format(c.revenueRate)} />
            <Field label="Plant tech contact" value={c.plantTechPersonDetails ?? '—'} />
          </Section>

          <Section title="Display Preferences" full>
            <Field
              label="Material location"
              value={c.displayMaterialLocation ? 'Shown to bidders' : 'Hidden'}
            />
            <Field
              label="Plant location"
              value={c.displayPlantLocation ? 'Shown to bidders' : 'Hidden'}
            />
          </Section>

          <Section title="Terms & Conditions" full>
            <TncLink file={c.tncFile} />
          </Section>
        </div>
      </div>
    </AppShell>
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

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 font-medium break-words">{value}</span>
    </div>
  );
}

function TncLink({ file }: { file: StoredFile | null }) {
  const api = useApiClient();
  if (!file) {
    return <p className="text-sm text-muted-foreground">No T&C document uploaded.</p>;
  }
  return (
    <div className="flex items-center justify-between text-sm">
      <div>
        <p className="font-medium">{file.originalName}</p>
        <p className="text-xs text-muted-foreground">
          {Math.round(file.sizeBytes / 1024)} KB · uploaded{' '}
          {new Date(file.createdAt).toLocaleDateString()}
        </p>
      </div>
      <a
        className="text-primary underline"
        href={api.files.contentUrl(file.id)}
        target="_blank"
        rel="noreferrer"
      >
        Download →
      </a>
    </div>
  );
}

function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
