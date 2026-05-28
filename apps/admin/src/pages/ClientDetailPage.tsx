import { useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type ClientWithTnc, type StoredFile } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type { ClientUpdateInput } from '@auction/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';
import { ClientAuctionHistorySection } from '../components/ClientAuctionHistorySection';
import { ClientEngagementsSection } from '../components/ClientEngagementsSection';
import { ClientInternalContactsSection } from '../components/ClientInternalContactsSection';
import { ClientLocationsSection } from '../components/ClientLocationsSection';

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

const TABS = ['details', 'locations', 'internal', 'engagement', 'auctions'] as const;
type TabId = (typeof TABS)[number];
const isTabId = (v: string | null): v is TabId =>
  !!v && (TABS as readonly string[]).includes(v);

export function ClientDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const api = useApiClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = isTabId(tabParam) ? tabParam : 'details';

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
            <TabsTrigger value="locations">Locations &amp; contacts</TabsTrigger>
            <TabsTrigger value="internal">KAMs &amp; internal</TabsTrigger>
            <TabsTrigger value="engagement">Engagement history</TabsTrigger>
            <TabsTrigger value="auctions">Auction history</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            <DetailsTab key={c.updatedAt} client={c} />
          </TabsContent>

          <TabsContent value="locations" className="mt-6">
            <ClientLocationsSection clientId={id} defaultCountry={c.country} />
          </TabsContent>

          <TabsContent value="internal" className="mt-6">
            <ClientInternalContactsSection clientId={id} />
          </TabsContent>

          <TabsContent value="engagement" className="mt-6">
            <ClientEngagementsSection clientId={id} />
          </TabsContent>

          <TabsContent value="auctions" className="mt-6">
            <ClientAuctionHistorySection clientId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

type Draft = ClientUpdateInput;

function toDraft(c: ClientWithTnc): Draft {
  return {
    companyName: c.companyName,
    phone: c.phone,
    websiteUrl: c.websiteUrl,
    registeredAddress: c.registeredAddress,
    country: c.country,
    pan: c.pan,
    tan: c.tan,
    tin: c.tin,
    isActive: c.isActive,
    prefixAuctionCode: c.prefixAuctionCode,
    suffixAuctionCode: c.suffixAuctionCode,
    autoExtend: c.autoExtend,
    extendIfLastBidSec: c.extendIfLastBidSec,
    extendDurationSec: c.extendDurationSec,
    extensionMaxTimes: c.extensionMaxTimes,
    staggeringOfLots: c.staggeringOfLots,
    staggeringOfLotsDurationSec: c.staggeringOfLotsDurationSec,
    staggeringOfAuction: c.staggeringOfAuction,
    staggeringOfAuctionDurationSec: c.staggeringOfAuctionDurationSec,
    otherChargeType: c.otherChargeType,
    otherChargeAmount: c.otherChargeAmount,
    revenueRate: c.revenueRate,
    plantTechPersonDetails: c.plantTechPersonDetails,
    displayMaterialLocation: c.displayMaterialLocation,
    displayPlantLocation: c.displayPlantLocation,
    allowsConsolidatedEmd: c.allowsConsolidatedEmd,
  };
}

function DetailsTab({ client: c }: { client: ClientWithTnc }) {
  const api = useApiClient();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(c));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.adminClients.update(c.id, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'client', c.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'clients'] });
      setEditing(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save'),
  });

  function startEdit() {
    setDraft(toDraft(c));
    setError(null);
    setEditing(true);
  }
  function cancelEdit() {
    setDraft(toDraft(c));
    setError(null);
    setEditing(false);
  }
  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {!editing ? (
          <Button variant="outline" size="sm" onClick={startEdit}>
            Edit details
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEdit}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Company">
          {editing ? (
            <>
              <EditRow label="Company name">
                <Input
                  value={draft.companyName}
                  onChange={(e) => patch('companyName', e.target.value)}
                  maxLength={100}
                />
              </EditRow>
              <EditRow label="Phone">
                <Input
                  value={draft.phone ?? ''}
                  onChange={(e) => patch('phone', e.target.value || null)}
                  maxLength={20}
                />
              </EditRow>
              <EditRow label="Website">
                <Input
                  value={draft.websiteUrl ?? ''}
                  onChange={(e) => patch('websiteUrl', e.target.value || null)}
                  maxLength={100}
                  placeholder="example.com"
                />
              </EditRow>
              <EditRow label="Country">
                <Select
                  value={draft.country}
                  onValueChange={(v) => patch('country', v as Draft['country'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="India">India</SelectItem>
                    <SelectItem value="UAE">UAE</SelectItem>
                  </SelectContent>
                </Select>
              </EditRow>
              <EditRow label="Registered address">
                <Textarea
                  value={draft.registeredAddress}
                  onChange={(e) => patch('registeredAddress', e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </EditRow>
            </>
          ) : (
            <>
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
            </>
          )}
        </Section>

        <Section title="Tax & Status">
          {editing ? (
            <>
              <EditRow label="PAN">
                <Input
                  value={draft.pan}
                  onChange={(e) => patch('pan', e.target.value.toUpperCase())}
                  maxLength={10}
                  className="font-mono"
                />
              </EditRow>
              <EditRow label="TAN">
                <Input
                  value={draft.tan}
                  onChange={(e) => patch('tan', e.target.value.toUpperCase())}
                  maxLength={10}
                  className="font-mono"
                />
              </EditRow>
              <EditRow label="TIN">
                <Input
                  value={draft.tin}
                  onChange={(e) => patch('tin', e.target.value.toUpperCase())}
                  maxLength={15}
                  className="font-mono"
                />
              </EditRow>
              <EditRow label="Active">
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    checked={draft.isActive}
                    onCheckedChange={(v) => patch('isActive', v === true)}
                  />
                  <span className="text-sm">
                    {draft.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </EditRow>
            </>
          ) : (
            <>
              <Field label="PAN" value={<code className="font-mono text-xs">{c.pan}</code>} />
              <Field label="TAN" value={<code className="font-mono text-xs">{c.tan}</code>} />
              <Field label="TIN" value={<code className="font-mono text-xs">{c.tin}</code>} />
              <Field label="Active" value={c.isActive ? 'Yes' : 'No'} />
            </>
          )}
        </Section>

        <Section title="Auction Codes">
          {editing ? (
            <>
              <EditRow label="Prefix">
                <Input
                  value={draft.prefixAuctionCode ?? ''}
                  onChange={(e) => patch('prefixAuctionCode', e.target.value || null)}
                  maxLength={25}
                  className="font-mono"
                />
              </EditRow>
              <EditRow label="Suffix">
                <Input
                  value={draft.suffixAuctionCode ?? ''}
                  onChange={(e) => patch('suffixAuctionCode', e.target.value || null)}
                  maxLength={25}
                  className="font-mono"
                />
              </EditRow>
            </>
          ) : (
            <>
              <Field label="Prefix" value={c.prefixAuctionCode ?? '—'} />
              <Field label="Suffix" value={c.suffixAuctionCode ?? '—'} />
            </>
          )}
        </Section>

        <Section title="Auto Extend">
          {editing ? (
            <>
              <EditRow label="Enabled">
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    checked={draft.autoExtend}
                    onCheckedChange={(v) => patch('autoExtend', v === true)}
                  />
                  <span className="text-sm">
                    {draft.autoExtend ? 'On' : 'Off'}
                  </span>
                </div>
              </EditRow>
              {draft.autoExtend && (
                <>
                  <EditRow label="Extend if last bid (sec)">
                    <Input
                      type="number"
                      min={0}
                      value={draft.extendIfLastBidSec ?? ''}
                      onChange={(e) =>
                        patch(
                          'extendIfLastBidSec',
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                    />
                  </EditRow>
                  <EditRow label="Extend duration (sec)">
                    <Input
                      type="number"
                      min={0}
                      value={draft.extendDurationSec ?? ''}
                      onChange={(e) =>
                        patch(
                          'extendDurationSec',
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                    />
                  </EditRow>
                  <EditRow label="Extension count">
                    <Input
                      type="number"
                      min={0}
                      value={draft.extensionMaxTimes ?? ''}
                      onChange={(e) =>
                        patch(
                          'extensionMaxTimes',
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                    />
                  </EditRow>
                </>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
        </Section>

        <Section title="Staggering">
          {editing ? (
            <>
              <EditRow label="Lots">
                <Select
                  value={draft.staggeringOfLots ?? '__none__'}
                  onValueChange={(v) =>
                    patch(
                      'staggeringOfLots',
                      v === '__none__' ? null : (v as Draft['staggeringOfLots']),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="all_lots">All lots</SelectItem>
                    <SelectItem value="subsequent_lots">Subsequent lots</SelectItem>
                  </SelectContent>
                </Select>
              </EditRow>
              {draft.staggeringOfLots && draft.staggeringOfLots !== 'none' && (
                <EditRow label="Lot duration (sec)">
                  <Input
                    type="number"
                    min={0}
                    value={draft.staggeringOfLotsDurationSec ?? ''}
                    onChange={(e) =>
                      patch(
                        'staggeringOfLotsDurationSec',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                  />
                </EditRow>
              )}
              <EditRow label="Auction">
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    checked={draft.staggeringOfAuction === true}
                    onCheckedChange={(v) => patch('staggeringOfAuction', v === true)}
                  />
                  <span className="text-sm">
                    {draft.staggeringOfAuction ? 'On' : 'Off'}
                  </span>
                </div>
              </EditRow>
              {draft.staggeringOfAuction && (
                <EditRow label="Auction duration (sec)">
                  <Input
                    type="number"
                    min={0}
                    value={draft.staggeringOfAuctionDurationSec ?? ''}
                    onChange={(e) =>
                      patch(
                        'staggeringOfAuctionDurationSec',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                  />
                </EditRow>
              )}
            </>
          ) : (
            <>
              <Field
                label="Lots"
                value={
                  c.staggeringOfLots
                    ? STAGGERING_LABEL[c.staggeringOfLots] ?? c.staggeringOfLots
                    : '—'
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
                value={c.staggeringOfAuction == null ? '—' : c.staggeringOfAuction ? 'Yes' : 'No'}
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
            </>
          )}
        </Section>

        <Section title="Charges & Revenue">
          {editing ? (
            <>
              <EditRow label="Other charge type">
                <Select
                  value={draft.otherChargeType ?? '__none__'}
                  onValueChange={(v) =>
                    patch(
                      'otherChargeType',
                      v === '__none__' ? null : (v as Draft['otherChargeType']),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </EditRow>
              {draft.otherChargeType && (
                <EditRow
                  label={draft.otherChargeType === 'percentage' ? 'Amount (%)' : 'Amount (₹)'}
                >
                  <Input
                    type="number"
                    min={0}
                    value={draft.otherChargeAmount ?? ''}
                    onChange={(e) =>
                      patch(
                        'otherChargeAmount',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                  />
                </EditRow>
              )}
              <EditRow label="Revenue rate (₹)">
                <Input
                  type="number"
                  min={0}
                  value={draft.revenueRate}
                  onChange={(e) => patch('revenueRate', Number(e.target.value) || 0)}
                />
              </EditRow>
              <EditRow label="Plant tech contact">
                <Input
                  value={draft.plantTechPersonDetails ?? ''}
                  onChange={(e) =>
                    patch('plantTechPersonDetails', e.target.value || null)
                  }
                  maxLength={200}
                />
              </EditRow>
            </>
          ) : (
            <>
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
            </>
          )}
        </Section>

        <Section title="Display Preferences" full>
          {editing ? (
            <>
              <EditRow label="Material location">
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    checked={draft.displayMaterialLocation}
                    onCheckedChange={(v) => patch('displayMaterialLocation', v === true)}
                  />
                  <span className="text-sm">
                    {draft.displayMaterialLocation ? 'Shown to bidders' : 'Hidden'}
                  </span>
                </div>
              </EditRow>
              <EditRow label="Plant location">
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    checked={draft.displayPlantLocation}
                    onCheckedChange={(v) => patch('displayPlantLocation', v === true)}
                  />
                  <span className="text-sm">
                    {draft.displayPlantLocation ? 'Shown to bidders' : 'Hidden'}
                  </span>
                </div>
              </EditRow>
              <EditRow label="Consolidated EMD">
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    checked={draft.allowsConsolidatedEmd}
                    onCheckedChange={(v) => patch('allowsConsolidatedEmd', v === true)}
                  />
                  <span className="text-sm">
                    {draft.allowsConsolidatedEmd ? 'Yes' : 'No'}
                  </span>
                </div>
              </EditRow>
            </>
          ) : (
            <>
              <Field
                label="Material location"
                value={c.displayMaterialLocation ? 'Shown to bidders' : 'Hidden'}
              />
              <Field
                label="Plant location"
                value={c.displayPlantLocation ? 'Shown to bidders' : 'Hidden'}
              />
              <Field
                label="Consolidated EMD"
                value={c.allowsConsolidatedEmd ? 'Yes' : 'No'}
              />
            </>
          )}
        </Section>

        <Section title="Terms & Conditions" full>
          <TncLink file={c.tncFile} />
        </Section>
      </div>
    </div>
  );
}

function EditRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 text-sm">
      <Label className="pt-2 text-muted-foreground">{label}</Label>
      <div className="col-span-2">{children}</div>
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
