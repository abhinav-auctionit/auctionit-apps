import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  type AdminStaffMember,
  type ClientInternalContactAssignment,
} from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type { InternalContactRole, InternalContactsUpdateInput } from '@auction/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@auction/ui';

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Action failed';

const ROLE_META: Record<
  InternalContactRole,
  { label: string; short: string; description: string; tone: string }
> = {
  kam: {
    label: 'Key account manager',
    short: 'KAM',
    description: 'Primary point of contact for this client',
    tone: 'bg-blue-100 text-blue-700',
  },
  asst_kam: {
    label: 'Asst. key account manager',
    short: 'Asst. KAM',
    description: 'Assists with daily coordination',
    tone: 'bg-violet-100 text-violet-700',
  },
  lifting_coordinator: {
    label: 'Lifting coordinator',
    short: 'Lifting',
    description: 'Post-auction material dispatch',
    tone: 'bg-emerald-100 text-emerald-700',
  },
  catalog_ops: {
    label: 'Catalog operations',
    short: 'Catalog',
    description: 'Material cataloging & lot creation',
    tone: 'bg-amber-100 text-amber-700',
  },
};

const SECONDARY_ROLES: InternalContactRole[] = ['asst_kam', 'lifting_coordinator', 'catalog_ops'];

type FormPayloadKey = keyof InternalContactsUpdateInput;
const ROLE_TO_KEY: Record<InternalContactRole, FormPayloadKey> = {
  kam: 'kam',
  asst_kam: 'asstKam',
  lifting_coordinator: 'liftingCoordinator',
  catalog_ops: 'catalogOps',
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?'
  );
}

function formatPhone(cc: string | null, num: string | null): string | null {
  if (!num) return null;
  return `${cc ?? ''} ${num}`.trim();
}

function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

export function ClientInternalContactsSection({ clientId }: { clientId: string }) {
  const api = useApiClient();
  const qc = useQueryClient();

  const contacts = useQuery({
    queryKey: ['admin', 'client', clientId, 'internal-contacts'],
    queryFn: () => api.adminClients.listInternalContacts(clientId),
    enabled: !!clientId,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const byRole = useMemo(() => {
    const m = new Map<InternalContactRole, ClientInternalContactAssignment>();
    for (const a of contacts.data ?? []) m.set(a.role, a);
    return m;
  }, [contacts.data]);

  const onCopy = (text: string, key: string) => {
    copyToClipboard(text);
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
  };

  if (contacts.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (contacts.error) {
    return <p className="text-sm text-destructive">{errMsg(contacts.error)}</p>;
  }

  const totalAssigned = contacts.data?.length ?? 0;
  const kam = byRole.get('kam') ?? null;

  return (
    <section className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        The internal team assigned to this client — key account manager, assistant KAM, lifting
        coordinator, and catalog operations contacts.
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">KAMs &amp; internal contacts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalAssigned} team {totalAssigned === 1 ? 'member' : 'members'} assigned
          </p>
        </div>
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          Edit assignments
        </Button>
      </div>

      <KamCard
        assignment={kam}
        onChange={() => setDialogOpen(true)}
        onCopy={onCopy}
        copied={copied}
      />

      <div className="grid gap-3 md:grid-cols-3">
        {SECONDARY_ROLES.map((role) => (
          <SecondaryCard
            key={role}
            role={role}
            assignment={byRole.get(role) ?? null}
            onCopy={onCopy}
            copied={copied}
          />
        ))}
      </div>

      {dialogOpen && (
        <EditAssignmentsDialog
          clientId={clientId}
          current={contacts.data ?? []}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            qc.invalidateQueries({
              queryKey: ['admin', 'client', clientId, 'internal-contacts'],
            });
          }}
        />
      )}
    </section>
  );
}

// -- KAM card -----------------------------------------------------------------

function KamCard({
  assignment,
  onChange,
  onCopy,
  copied,
}: {
  assignment: ClientInternalContactAssignment | null;
  onChange: () => void;
  onCopy: (text: string, key: string) => void;
  copied: string | null;
}) {
  const meta = ROLE_META.kam;
  if (!assignment) {
    return (
      <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/40 p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
            {meta.label}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            No KAM assigned yet. Click <strong>Edit assignments</strong> to add one.
          </p>
        </div>
        <Button size="sm" onClick={onChange}>
          Assign KAM
        </Button>
      </div>
    );
  }

  const phone = formatPhone(assignment.user.mobileCountryCode, assignment.user.mobileNumber);
  const since = new Date(assignment.assignedAt).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
  const kamCount = assignment.kamClientCount ?? 0;

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-blue-100 text-base font-semibold text-blue-700">
            {initials(assignment.user.name)}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
              {meta.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold">{assignment.user.name}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <CopyButton
                label={assignment.user.email}
                value={assignment.user.email}
                onCopy={onCopy}
                copied={copied}
                copyKey={`kam-email-${assignment.id}`}
              />
              {phone && (
                <CopyButton
                  label={phone}
                  value={phone}
                  onCopy={onCopy}
                  copied={copied}
                  copyKey={`kam-phone-${assignment.id}`}
                />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Managing this account since {since} · {kamCount}{' '}
              {kamCount === 1 ? 'client' : 'clients'} total
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onChange}
          className="text-sm text-primary hover:underline"
        >
          Change KAM
        </button>
      </div>
    </div>
  );
}

// -- Secondary card -----------------------------------------------------------

function SecondaryCard({
  role,
  assignment,
  onCopy,
  copied,
}: {
  role: InternalContactRole;
  assignment: ClientInternalContactAssignment | null;
  onCopy: (text: string, key: string) => void;
  copied: string | null;
}) {
  const meta = ROLE_META[role];
  if (!assignment) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {meta.label}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Not assigned</p>
        <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
      </div>
    );
  }

  const phone = formatPhone(assignment.user.mobileCountryCode, assignment.user.mobileNumber);
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {meta.label}
      </p>
      <div className="mt-3 flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${meta.tone}`}
        >
          {initials(assignment.user.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{assignment.user.name}</p>
          <CopyButton
            label={assignment.user.email}
            value={assignment.user.email}
            onCopy={onCopy}
            copied={copied}
            copyKey={`${role}-email-${assignment.id}`}
            className="block truncate text-xs"
          />
          {phone && (
            <CopyButton
              label={phone}
              value={phone}
              onCopy={onCopy}
              copied={copied}
              copyKey={`${role}-phone-${assignment.id}`}
              className="block truncate text-xs"
            />
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{meta.description}</p>
    </div>
  );
}

function CopyButton({
  label,
  value,
  onCopy,
  copied,
  copyKey,
  className,
}: {
  label: string;
  value: string;
  onCopy: (text: string, key: string) => void;
  copied: string | null;
  copyKey: string;
  className?: string;
}) {
  const isCopied = copied === copyKey;
  return (
    <button
      type="button"
      onClick={() => onCopy(value, copyKey)}
      className={`text-muted-foreground hover:text-foreground ${className ?? ''}`}
      title={isCopied ? 'Copied!' : 'Click to copy'}
    >
      {isCopied ? 'Copied!' : label}
    </button>
  );
}

// -- Edit dialog --------------------------------------------------------------

function EditAssignmentsDialog({
  clientId,
  current,
  onClose,
  onSaved,
}: {
  clientId: string;
  current: ClientInternalContactAssignment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const staff = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: () => api.adminStaff.list(),
  });

  const initial = useMemo(() => {
    const map: Record<FormPayloadKey, string | null> = {
      kam: null,
      asstKam: null,
      liftingCoordinator: null,
      catalogOps: null,
    };
    for (const a of current) map[ROLE_TO_KEY[a.role]] = a.user.id;
    return map;
  }, [current]);

  const [form, setForm] = useState<Record<FormPayloadKey, string | null>>(initial);

  const save = useMutation({
    mutationFn: () => api.adminClients.setInternalContacts(clientId, form),
    onSuccess: onSaved,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  const noneValue = '__none__';

  const rolesInOrder: { role: InternalContactRole; key: FormPayloadKey }[] = [
    { role: 'kam', key: 'kam' },
    { role: 'asst_kam', key: 'asstKam' },
    { role: 'lifting_coordinator', key: 'liftingCoordinator' },
    { role: 'catalog_ops', key: 'catalogOps' },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit assignments</DialogTitle>
          <DialogDescription>
            Pick a team member for each role. Leave a role unassigned by selecting{' '}
            <em>Unassigned</em>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {staff.isLoading && (
            <p className="text-sm text-muted-foreground">Loading staff directory…</p>
          )}
          {staff.error && <p className="text-sm text-destructive">{errMsg(staff.error)}</p>}
          {staff.data &&
            rolesInOrder.map(({ role, key }) => (
              <div key={role} className="space-y-1.5">
                <Label className="text-xs">{ROLE_META[role].label}</Label>
                <Select
                  value={form[key] ?? noneValue}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, [key]: v === noneValue ? null : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noneValue}>Unassigned</SelectItem>
                    {staff.data.map((u: AdminStaffMember) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          {save.error && <p className="text-sm text-destructive">{errMsg(save.error)}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !staff.data}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
