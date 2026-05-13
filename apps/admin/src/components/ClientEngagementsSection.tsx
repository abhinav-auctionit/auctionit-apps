import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  type ClientEngagementWithUser,
} from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type {
  ClientEngagementCreateInput,
  EngagementMedium,
  EngagementPurpose,
} from '@auction/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@auction/ui';

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Action failed';

const PURPOSE_OPTIONS: Array<{ value: EngagementPurpose; label: string; tone: string }> = [
  { value: 'auction_follow_up', label: 'Auction follow-up', tone: 'bg-blue-100 text-blue-700' },
  { value: 'auction_debrief', label: 'Auction debrief', tone: 'bg-sky-100 text-sky-700' },
  {
    value: 'complaint_escalation',
    label: 'Complaint / escalation',
    tone: 'bg-rose-100 text-rose-700',
  },
  { value: 'invoice_query', label: 'Invoice query', tone: 'bg-amber-100 text-amber-700' },
  { value: 'general_check_in', label: 'Check-in', tone: 'bg-emerald-100 text-emerald-700' },
  { value: 'other', label: 'Other', tone: 'bg-slate-100 text-slate-700' },
];
const PURPOSE_BY_VALUE = Object.fromEntries(
  PURPOSE_OPTIONS.map((o) => [o.value, o]),
) as Record<EngagementPurpose, (typeof PURPOSE_OPTIONS)[number]>;

const MEDIUM_OPTIONS: Array<{ value: EngagementMedium; label: string }> = [
  { value: 'phone_call', label: 'Phone call' },
  { value: 'email', label: 'Email' },
  { value: 'in_person', label: 'In person' },
  { value: 'video_call', label: 'Video call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Other' },
];
const MEDIUM_BY_VALUE = Object.fromEntries(
  MEDIUM_OPTIONS.map((o) => [o.value, o.label]),
) as Record<EngagementMedium, string>;

const MONTH_LABELS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type FormState = {
  happenedAtLocal: string;
  personName: string;
  personRole: string;
  purpose: EngagementPurpose;
  medium: EngagementMedium;
  comments: string;
};

const emptyForm = (): FormState => ({
  happenedAtLocal: toLocalInput(new Date()),
  personName: '',
  personRole: '',
  purpose: 'auction_follow_up',
  medium: 'phone_call',
  comments: '',
});

export function ClientEngagementsSection({ clientId }: { clientId: string }) {
  const api = useApiClient();
  const qc = useQueryClient();

  const engagements = useQuery({
    queryKey: ['admin', 'client', clientId, 'engagements'],
    queryFn: () => api.adminClients.listEngagements(clientId),
    enabled: !!clientId,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientEngagementWithUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [purposeFilter, setPurposeFilter] = useState<EngagementPurpose | 'all'>('all');
  const [monthFilter, setMonthFilter] = useState<'all' | '3' | '6' | '12'>('all');
  const [deleteTarget, setDeleteTarget] = useState<ClientEngagementWithUser | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'client', clientId, 'engagements'] });

  const save = useMutation({
    mutationFn: () => {
      const payload: ClientEngagementCreateInput = {
        happenedAt: new Date(form.happenedAtLocal).toISOString(),
        personName: form.personName,
        personRole: form.personRole.trim() ? form.personRole : null,
        purpose: form.purpose,
        medium: form.medium,
        comments: form.comments,
      };
      if (editing) {
        return api.adminClients.updateEngagement(clientId, editing.id, payload);
      }
      return api.adminClients.createEngagement(clientId, payload);
    },
    onSuccess: () => {
      closeForm();
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.adminClients.deleteEngagement(clientId, id),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
  });

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm());
    save.reset();
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (e: ClientEngagementWithUser) => {
    setEditing(e);
    setForm({
      happenedAtLocal: toLocalInput(new Date(e.happenedAt)),
      personName: e.personName,
      personRole: e.personRole ?? '',
      purpose: e.purpose,
      medium: e.medium,
      comments: e.comments,
    });
    setFormOpen(true);
  };

  const filtered = useMemo(() => {
    const list = engagements.data ?? [];
    const now = Date.now();
    const cutoff =
      monthFilter === 'all' ? 0 : now - parseInt(monthFilter, 10) * 30 * 24 * 60 * 60 * 1000;
    return list.filter((e) => {
      if (purposeFilter !== 'all' && e.purpose !== purposeFilter) return false;
      if (monthFilter !== 'all' && new Date(e.happenedAt).getTime() < cutoff) return false;
      return true;
    });
  }, [engagements.data, purposeFilter, monthFilter]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);
  const totalCount = engagements.data?.length ?? 0;

  return (
    <section className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        A daily sales report. Log conversations and interactions with this client. Entries are
        grouped month-wise; anyone on the admin team can add and edit.
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Engagement history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'interaction' : 'interactions'} logged
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <Select
              value={monthFilter}
              onValueChange={(v) => setMonthFilter(v as typeof monthFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select
              value={purposeFilter}
              onValueChange={(v) => setPurposeFilter(v as typeof purposeFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All purposes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All purposes</SelectItem>
                {PURPOSE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!formOpen && <Button onClick={openCreate}>+ Log interaction</Button>}
        </div>
      </div>

      {formOpen && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">
              {editing ? 'Edit interaction' : 'Log new interaction'}
            </h3>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Date &amp; time <span className="text-destructive">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={form.happenedAtLocal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, happenedAtLocal: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Person met <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.personName}
                onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
                placeholder="e.g. Rajesh Mehta"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role / Designation</Label>
              <Input
                value={form.personRole}
                onChange={(e) => setForm((f) => ({ ...f, personRole: e.target.value }))}
                placeholder="e.g. Plant Head"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Medium <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.medium}
                onValueChange={(v) => setForm((f) => ({ ...f, medium: v as EngagementMedium }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDIUM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">
                Purpose <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.purpose}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, purpose: v as EngagementPurpose }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">
                Comments <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={4}
                value={form.comments}
                onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                placeholder="What was discussed? Key takeaways, next steps…"
                required
              />
            </div>
          </div>

          {save.error && <p className="text-sm text-destructive">{errMsg(save.error)}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Submit'}
            </Button>
          </div>
        </form>
      )}

      {engagements.isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {engagements.error && (
        <p className="text-sm text-destructive">{errMsg(engagements.error)}</p>
      )}

      {engagements.data && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {totalCount === 0
              ? 'No interactions logged yet.'
              : 'No interactions match the current filters.'}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(({ key, label, entries }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                {label}
              </p>
              <span className="text-xs text-muted-foreground">{entries.length}</span>
            </div>
            <div className="divide-y">
              {entries.map((e) => (
                <EngagementRow
                  key={e.id}
                  engagement={e}
                  onEdit={() => openEdit(e)}
                  onDelete={() => setDeleteTarget(e)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete interaction?</DialogTitle>
            <DialogDescription>
              This permanently removes the engagement entry. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {remove.error && (
            <p className="text-sm text-destructive">{errMsg(remove.error)}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EngagementRow({
  engagement: e,
  onEdit,
  onDelete,
}: {
  engagement: ClientEngagementWithUser;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = new Date(e.happenedAt);
  const day = date.getDate();
  const monthShort = SHORT_MONTH[date.getMonth()]!;
  const purpose = PURPOSE_BY_VALUE[e.purpose];
  const mediumLabel = MEDIUM_BY_VALUE[e.medium];
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-4 py-4">
      <div className="flex w-10 flex-col items-center justify-center text-center">
        <span className="text-lg font-semibold leading-none tabular-nums">{day}</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {monthShort}
        </span>
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{purpose?.label ?? e.purpose}</span>
          <Badge className={`${purpose?.tone ?? ''} hover:${purpose?.tone ?? ''}`}>
            {mediumLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">with </span>
          <span className="font-medium">{e.personName}</span>
          {e.personRole && (
            <span className="text-muted-foreground"> ({e.personRole})</span>
          )}
        </p>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{e.comments}</p>
        {e.createdBy && (
          <p className="text-xs text-muted-foreground">
            Logged by <span className="font-medium">{e.createdBy.name}</span>
          </p>
        )}
      </div>
      <div className="flex items-start gap-3 text-xs">
        <button type="button" className="text-primary hover:underline" onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className="text-destructive hover:underline"
          onClick={onDelete}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// -- Helpers ----------------------------------------------------------------

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function groupByMonth(entries: ClientEngagementWithUser[]) {
  const map = new Map<string, ClientEngagementWithUser[]>();
  for (const e of entries) {
    const d = new Date(e.happenedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .map(([key, list]) => {
      const [yr, mo] = key.split('-').map(Number);
      return {
        key,
        label: `${MONTH_LABELS[mo!]} ${yr}`,
        entries: list,
      };
    })
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}
