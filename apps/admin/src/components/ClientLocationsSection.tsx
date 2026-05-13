import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  type ClientContactPoint,
  type ClientLocationWithContacts,
} from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type {
  ClientContactCreateInput,
  ClientLocationCreateInput,
} from '@auction/types';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@auction/ui';

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Action failed';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
];
const colorFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
};

type LocationDialogState =
  | { mode: 'create' }
  | { mode: 'edit'; location: ClientLocationWithContacts }
  | null;

type ContactDialogState =
  | { mode: 'create'; locationId: string }
  | { mode: 'edit'; locationId: string; contact: ClientContactPoint }
  | null;

export function ClientLocationsSection({
  clientId,
  defaultCountry,
}: {
  clientId: string;
  defaultCountry: string;
}) {
  const api = useApiClient();
  const qc = useQueryClient();

  const locations = useQuery({
    queryKey: ['admin', 'client', clientId, 'locations'],
    queryFn: () => api.adminClients.listLocations(clientId),
    enabled: !!clientId,
  });

  const [locationDialog, setLocationDialog] = useState<LocationDialogState>(null);
  const [contactDialog, setContactDialog] = useState<ContactDialogState>(null);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [deleteContact, setDeleteContact] = useState<
    { locationId: string; contact: ClientContactPoint } | null
  >(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'client', clientId, 'locations'] });

  const removeLocation = useMutation({
    mutationFn: (locationId: string) => api.adminClients.deleteLocation(clientId, locationId),
    onSuccess: () => {
      setDeleteLocationId(null);
      invalidate();
    },
  });
  const removeContact = useMutation({
    mutationFn: ({ locationId, contactId }: { locationId: string; contactId: string }) =>
      api.adminClients.deleteContact(clientId, locationId, contactId),
    onSuccess: () => {
      setDeleteContact(null);
      invalidate();
    },
  });

  const counts = useMemo(() => {
    const locs = locations.data ?? [];
    const contacts = locs.reduce((sum, l) => sum + l.contacts.length, 0);
    return { locs: locs.length, contacts };
  }, [locations.data]);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Locations &amp; contact points</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.locs} {counts.locs === 1 ? 'location' : 'locations'} · {counts.contacts}{' '}
            {counts.contacts === 1 ? 'contact' : 'contacts'}
          </p>
        </div>
        <Button onClick={() => setLocationDialog({ mode: 'create' })}>+ Add location</Button>
      </div>

      {locations.isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {locations.error && (
        <p className="text-sm text-destructive">{errMsg(locations.error)}</p>
      )}
      {locations.data && locations.data.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No locations yet. Click <strong>+ Add location</strong> to add the first plant or
            facility.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {(locations.data ?? []).map((loc) => (
          <LocationCard
            key={loc.id}
            location={loc}
            onEdit={() => setLocationDialog({ mode: 'edit', location: loc })}
            onDelete={() => setDeleteLocationId(loc.id)}
            onAddContact={() => setContactDialog({ mode: 'create', locationId: loc.id })}
            onEditContact={(contact) =>
              setContactDialog({ mode: 'edit', locationId: loc.id, contact })
            }
            onRemoveContact={(contact) => setDeleteContact({ locationId: loc.id, contact })}
          />
        ))}
      </div>

      {locationDialog && (
        <LocationDialog
          clientId={clientId}
          defaultCountry={defaultCountry}
          state={locationDialog}
          onClose={() => setLocationDialog(null)}
          onSaved={() => {
            setLocationDialog(null);
            invalidate();
          }}
        />
      )}

      {contactDialog && (
        <ContactDialog
          clientId={clientId}
          state={contactDialog}
          onClose={() => setContactDialog(null)}
          onSaved={() => {
            setContactDialog(null);
            invalidate();
          }}
        />
      )}

      <Dialog
        open={!!deleteLocationId}
        onOpenChange={(o) => {
          if (!o) setDeleteLocationId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete location?</DialogTitle>
            <DialogDescription>
              This permanently removes the location and all of its contact points. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {removeLocation.error && (
            <p className="text-sm text-destructive">{errMsg(removeLocation.error)}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLocationId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteLocationId && removeLocation.mutate(deleteLocationId)}
              disabled={removeLocation.isPending}
            >
              {removeLocation.isPending ? 'Deleting…' : 'Delete location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteContact}
        onOpenChange={(o) => {
          if (!o) setDeleteContact(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove contact?</DialogTitle>
            <DialogDescription>
              {deleteContact ? (
                <>
                  Remove <strong>{deleteContact.contact.name}</strong> from this location?
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {removeContact.error && (
            <p className="text-sm text-destructive">{errMsg(removeContact.error)}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteContact(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteContact &&
                removeContact.mutate({
                  locationId: deleteContact.locationId,
                  contactId: deleteContact.contact.id,
                })
              }
              disabled={removeContact.isPending}
            >
              {removeContact.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LocationCard({
  location,
  onEdit,
  onDelete,
  onAddContact,
  onEditContact,
  onRemoveContact,
}: {
  location: ClientLocationWithContacts;
  onEdit: () => void;
  onDelete: () => void;
  onAddContact: () => void;
  onEditContact: (contact: ClientContactPoint) => void;
  onRemoveContact: (contact: ClientContactPoint) => void;
}) {
  const addressLine = [location.city, location.state].filter(Boolean).join(', ');
  const addressFull = location.pincode ? `${addressLine} — ${location.pincode}` : addressLine;

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold ${colorFor(
              location.id,
            )}`}
          >
            {initials(location.name)}
          </div>
          <div>
            <p className="font-semibold">{location.name}</p>
            <p className="text-sm text-muted-foreground">
              {location.addressLine ? `${location.addressLine}, ${addressFull}` : addressFull}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {location.isPrimary ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Primary
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Secondary</span>
          )}
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={onAddContact}>
            + Add contact
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {location.contacts.length === 0 ? (
          <p className="rounded-md bg-muted/40 py-4 text-center text-xs text-muted-foreground">
            No contacts yet. Click <strong>+ Add contact</strong> to add a person at this
            location.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Name</th>
                  <th className="py-2 pr-3 text-left font-medium">Role / Designation</th>
                  <th className="py-2 pr-3 text-left font-medium">Email</th>
                  <th className="py-2 pr-3 text-left font-medium">Phone</th>
                  <th className="py-2 pr-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {location.contacts.map((c) => (
                  <tr key={c.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ${colorFor(
                            c.id,
                          )}`}
                        >
                          {initials(c.name)}
                        </span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{c.role ?? '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{c.email ?? '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{c.phone ?? '—'}</td>
                    <td className="py-2 pr-3 text-right">
                      <div className="inline-flex gap-3 text-xs">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => onEditContact(c)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-destructive hover:underline"
                          onClick={() => onRemoveContact(c)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Location dialog ---------------------------------------------------------

function LocationDialog({
  clientId,
  defaultCountry,
  state,
  onClose,
  onSaved,
}: {
  clientId: string;
  defaultCountry: string;
  state: Exclude<LocationDialogState, null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const isEdit = state.mode === 'edit';
  const initial = isEdit ? state.location : null;

  const [form, setForm] = useState<ClientLocationCreateInput>({
    name: initial?.name ?? '',
    addressLine: initial?.addressLine ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
    country: initial?.country ?? defaultCountry,
    isPrimary: initial?.isPrimary ?? false,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload: ClientLocationCreateInput = {
        ...form,
        addressLine: form.addressLine?.toString().trim() ? form.addressLine : null,
      };
      if (isEdit) {
        return api.adminClients.updateLocation(clientId, state.location.id, payload);
      }
      return api.adminClients.createLocation(clientId, payload);
    },
    onSuccess: onSaved,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit location' : 'Add location'}</DialogTitle>
          <DialogDescription>
            Plants, facilities, warehouses, or any physical site for this client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field
            label="Name"
            required
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Mundra Plant"
          />
          <Field
            label="Address line"
            value={form.addressLine ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, addressLine: v }))}
            placeholder="Street / building (optional)"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="City"
              required
              value={form.city}
              onChange={(v) => setForm((f) => ({ ...f, city: v }))}
            />
            <Field
              label="State"
              required
              value={form.state}
              onChange={(v) => setForm((f) => ({ ...f, state: v }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Pincode"
              required
              value={form.pincode}
              onChange={(v) => setForm((f) => ({ ...f, pincode: v }))}
            />
            <Field
              label="Country"
              required
              value={form.country}
              onChange={(v) => setForm((f) => ({ ...f, country: v }))}
            />
          </div>
          <label className="flex items-center gap-2 pt-1 text-sm">
            <Checkbox
              checked={form.isPrimary}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isPrimary: v === true }))}
            />
            <span>Set as primary location</span>
          </label>
          {save.error && <p className="text-sm text-destructive">{errMsg(save.error)}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -- Contact dialog ----------------------------------------------------------

function ContactDialog({
  clientId,
  state,
  onClose,
  onSaved,
}: {
  clientId: string;
  state: Exclude<ContactDialogState, null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const isEdit = state.mode === 'edit';
  const initial = isEdit ? state.contact : null;

  const [form, setForm] = useState<ClientContactCreateInput>({
    name: initial?.name ?? '',
    role: initial?.role ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
  });

  const save = useMutation({
    mutationFn: () => {
      const payload: ClientContactCreateInput = {
        name: form.name,
        role: form.role?.toString().trim() ? form.role : null,
        email: form.email?.toString().trim() ? form.email : null,
        phone: form.phone?.toString().trim() ? form.phone : null,
      };
      if (isEdit) {
        return api.adminClients.updateContact(
          clientId,
          state.locationId,
          state.contact.id,
          payload,
        );
      }
      return api.adminClients.createContact(clientId, state.locationId, payload);
    },
    onSuccess: onSaved,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit contact' : 'Add contact'}</DialogTitle>
          <DialogDescription>Person to reach at this location.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field
            label="Name"
            required
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Rajesh Mehta"
          />
          <Field
            label="Role / Designation"
            value={form.role ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
            placeholder="Plant Head"
          />
          <Field
            label="Email"
            type="email"
            value={form.email ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="name@company.com"
          />
          <Field
            label="Phone"
            value={form.phone ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            placeholder="+91 98765 43210"
          />
          {save.error && <p className="text-sm text-destructive">{errMsg(save.error)}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}
