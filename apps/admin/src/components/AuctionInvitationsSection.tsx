import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type InviteResult } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type { InvitationNotificationStatus } from '@auction/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@auction/ui';

const STATUS_BADGE: Record<
  InvitationNotificationStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Pending', variant: 'outline' },
  sent: { label: 'Sent', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
  skipped: { label: 'No mobile', variant: 'secondary' },
};

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Action failed';

export function AuctionInvitationsSection({
  auctionId,
  canInvite,
}: {
  auctionId: string;
  canInvite: boolean;
}) {
  const api = useApiClient();
  const qc = useQueryClient();

  const invitations = useQuery({
    queryKey: ['admin', 'auction', auctionId, 'invitations'],
    queryFn: () => api.adminAuctions.listInvitations(auctionId),
    enabled: !!auctionId,
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [uninviteId, setUninviteId] = useState<string | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'auction', auctionId, 'invitations'] });

  const uninvite = useMutation({
    mutationFn: (id: string) => api.adminAuctions.uninvite(auctionId, id),
    onSuccess: () => {
      setUninviteId(null);
      invalidate();
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          Invitations ({invitations.data?.length ?? 0})
        </CardTitle>
        {canInvite && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            + Invite bidders
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {invitations.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {invitations.error && (
          <p className="text-sm text-destructive">{errMsg(invitations.error)}</p>
        )}
        {invitations.data && invitations.data.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {canInvite
              ? 'No bidders invited yet. Click + Invite bidders.'
              : 'No invitations.'}
          </p>
        )}
        {invitations.data && invitations.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bidder</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Notification</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.data.map((i) => {
                const badge =
                  STATUS_BADGE[i.notificationStatus] ?? STATUS_BADGE.pending;
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium">{i.bidderProfile.fullName}</div>
                      {i.bidderProfile.companyName && (
                        <div className="text-xs text-muted-foreground">
                          {i.bidderProfile.companyName}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {i.bidderProfile.user.email}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {i.bidderProfile.contactCountryCode}
                      {i.bidderProfile.contactNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {i.notificationError && (
                        <div
                          className="mt-1 max-w-xs truncate text-xs text-destructive"
                          title={i.notificationError}
                        >
                          {i.notificationError}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {i.joinedAt ? (
                        <div className="space-y-1">
                          <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-700">
                            Joined
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {new Date(i.joinedAt).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(i.invitedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {canInvite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setUninviteId(i.id)}
                          disabled={!!i.joinedAt}
                          title={
                            i.joinedAt
                              ? 'Bidder has already joined and paid EMD'
                              : undefined
                          }
                        >
                          Uninvite
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {inviteOpen && (
        <InviteBiddersDialog
          auctionId={auctionId}
          alreadyInvitedIds={new Set((invitations.data ?? []).map((i) => i.bidderProfileId))}
          onClose={() => setInviteOpen(false)}
          onCompleted={() => {
            invalidate();
          }}
        />
      )}

      <Dialog
        open={!!uninviteId}
        onOpenChange={(o) => {
          if (!o) {
            setUninviteId(null);
            uninvite.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninvite this bidder?</DialogTitle>
            <DialogDescription>
              The bidder will no longer see this auction. Blocked if they&apos;ve already placed
              a bid.
            </DialogDescription>
          </DialogHeader>
          {uninvite.error && (
            <p className="text-sm text-destructive">{errMsg(uninvite.error)}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUninviteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => uninviteId && uninvite.mutate(uninviteId)}
              disabled={uninvite.isPending}
            >
              {uninvite.isPending ? 'Uninviting…' : 'Uninvite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---- Invite dialog -------------------------------------------------------

function InviteBiddersDialog({
  auctionId,
  alreadyInvitedIds,
  onClose,
  onCompleted,
}: {
  auctionId: string;
  alreadyInvitedIds: Set<string>;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const api = useApiClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<InviteResult | null>(null);

  const bidders = useQuery({
    queryKey: ['admin', 'bidder-profiles', 'approved'],
    queryFn: () => api.adminBidders.list({ status: 'approved' }),
  });

  const filtered = useMemo(() => {
    const all = bidders.data ?? [];
    const q = search.trim().toLowerCase();
    const eligible = all.filter((b) => !alreadyInvitedIds.has(b.id));
    if (!q) return eligible;
    return eligible.filter((b) =>
      [b.fullName, b.user.email, b.user.name, b.companyName]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [bidders.data, alreadyInvitedIds, search]);

  const invite = useMutation({
    mutationFn: () =>
      api.adminAuctions.invite(auctionId, {
        bidderProfileIds: Array.from(selected),
      }),
    onSuccess: (r) => {
      setResult(r);
      setSelected(new Set());
      onCompleted();
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of filtered) next.add(b.id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite bidders</DialogTitle>
          <DialogDescription>
            Pick approved bidders to invite. Each gets an SMS notification with the auction
            reference.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-secondary/40 p-3 text-sm">
              <p className="font-medium">Invitations dispatched</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <dt>Requested</dt>
                <dd className="text-foreground">{result.summary.requested}</dd>
                <dt>Newly invited</dt>
                <dd className="text-foreground">{result.summary.created}</dd>
                <dt>Already invited (skipped)</dt>
                <dd className="text-foreground">{result.summary.skippedExisting}</dd>
                <dt>SMS sent</dt>
                <dd className="text-foreground">{result.summary.sent}</dd>
                <dt>SMS failed</dt>
                <dd className="text-foreground">{result.summary.failed}</dd>
                <dt>No mobile on file</dt>
                <dd className="text-foreground">{result.summary.notSent}</dd>
              </dl>
              {result.summary.notFound.length > 0 && (
                <p className="mt-2 text-xs text-destructive">
                  {result.summary.notFound.length} id(s) didn&apos;t match an approved bidder.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Name, email, or company"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {selected.size} selected · {filtered.length} eligible
                {alreadyInvitedIds.size > 0 && (
                  <> · {alreadyInvitedIds.size} already invited (hidden)</>
                )}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="hover:text-foreground hover:underline"
                  onClick={selectAllVisible}
                  disabled={filtered.length === 0}
                >
                  Select all visible
                </button>
                <button
                  type="button"
                  className="hover:text-foreground hover:underline"
                  onClick={clearSelection}
                  disabled={selected.size === 0}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border">
              {bidders.isLoading && (
                <p className="px-3 py-4 text-sm text-muted-foreground">Loading bidders…</p>
              )}
              {bidders.error && (
                <p className="px-3 py-4 text-sm text-destructive">{errMsg(bidders.error)}</p>
              )}
              {bidders.data && filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No bidders match. {alreadyInvitedIds.size > 0 && 'All approved bidders may already be invited.'}
                </p>
              )}
              {filtered.length > 0 && (
                <ul className="divide-y">
                  {filtered.map((b) => {
                    const checked = selected.has(b.id);
                    return (
                      <li key={b.id}>
                        <label
                          htmlFor={`b-${b.id}`}
                          className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-secondary"
                        >
                          <Checkbox
                            id={`b-${b.id}`}
                            checked={checked}
                            onCheckedChange={() => toggle(b.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{b.fullName}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {b.user.email}
                              {b.companyName && <> · {b.companyName}</>}
                            </div>
                          </div>
                          <div className="shrink-0 font-mono text-xs text-muted-foreground">
                            {b.contactCountryCode}
                            {b.contactNumber}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {invite.error && (
              <p className="text-sm text-destructive">{errMsg(invite.error)}</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={invite.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => invite.mutate()}
                disabled={invite.isPending || selected.size === 0}
              >
                {invite.isPending
                  ? 'Inviting…'
                  : `Invite ${selected.size} bidder${selected.size === 1 ? '' : 's'}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
