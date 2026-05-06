import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type AttributeListItem, type ItemAttributeValueRead } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
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
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

export function ItemDetailPage() {
  const { id = '' } = useParams();
  const api = useApiClient();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const itemQuery = useQuery({
    queryKey: ['inventory', 'item', id],
    queryFn: () => api.inventory.getItem(id),
    enabled: !!id,
  });
  const attrsQuery = useQuery({
    queryKey: ['inventory', 'attributes'],
    queryFn: () => api.inventory.listAttributes(),
  });

  const [adderOpen, setAdderOpen] = useState<{ mode: 'library' | 'custom' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const removeValue = useMutation({
    mutationFn: (valueId: string) => api.inventory.removeAttributeValue(id, valueId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'item', id] }),
  });
  const deleteItem = useMutation({
    mutationFn: () => api.inventory.deleteItem(id),
    onSuccess: () => navigate('/items', { replace: true }),
  });

  const attachedAttributeIds = useMemo(
    () =>
      new Set(
        itemQuery.data?.attributeValues.map((v) => v.attributeId).filter(Boolean) as string[],
      ),
    [itemQuery.data],
  );

  const it = itemQuery.data;

  return (
    <AppShell>
      {itemQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {itemQuery.error && (
        <p className="text-sm text-destructive">
          {itemQuery.error instanceof ApiError ? itemQuery.error.message : 'Failed to load'}
        </p>
      )}
      {it && (
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              <Link to="/items" className="hover:text-foreground">Items</Link> ›{' '}
              {it.categoryName} › {it.subcategoryName}
            </p>
            <div className="mt-1 flex items-center justify-between">
              <h1 className="text-2xl font-semibold">{it.name}</h1>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Basics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-y-4 gap-x-8 md:grid-cols-2">
              <Field label="Item name" value={it.name} />
              <Field label="Subcategory" value={`${it.categoryName} › ${it.subcategoryName}`} />
              <Field label="Unit of measure" value={it.uom} />
              <Field label="HSN code" value={it.hsnCode ?? '—'} mono />
              <Field
                label="Latest benchmark"
                value={
                  it.benchmarkCents !== null
                    ? `₹${(it.benchmarkCents / 100).toLocaleString('en-IN')} / ${it.uom}`
                    : '—'
                }
              />
              <Field
                label="Created"
                value={new Date(it.createdAt).toLocaleString()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Attributes ({it.attributeValues.length})
              </CardTitle>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Specific to this item
              </span>
            </CardHeader>
            <CardContent>
              {it.attributeValues.length === 0 && (
                <p className="text-sm text-muted-foreground">No attributes attached yet.</p>
              )}
              <ul className="divide-y divide-border">
                {it.attributeValues.map((v) => (
                  <li key={v.id} className="grid grid-cols-[220px_1fr_auto] items-center gap-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{v.attrName ?? v.customName}</span>
                        {v.attributeId === null && (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            Custom
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {v.attrType
                          ? `${labelForType(v.attrType)} · from library`
                          : 'Custom · this item only'}
                        {v.attrUnit ? ` · ${v.attrUnit}` : ''}
                      </div>
                    </div>
                    <div className="text-sm">{renderValue(v, attrsQuery.data)}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeValue.mutate(v.id)}
                      disabled={removeValue.isPending}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setAdderOpen({ mode: 'library' })}>
                  + Add from library
                </Button>
                <Button variant="outline" onClick={() => setAdderOpen({ mode: 'custom' })}>
                  + Custom attribute
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AddValueDialog
        open={!!adderOpen}
        mode={adderOpen?.mode ?? 'library'}
        onOpenChange={(o) => !o && setAdderOpen(null)}
        attributes={attrsQuery.data ?? []}
        attachedAttributeIds={attachedAttributeIds}
        onAdded={() => qc.invalidateQueries({ queryKey: ['inventory', 'item', id] })}
        itemId={id}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              All attached attribute values will be removed. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItem.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</div>
    </div>
  );
}

function labelForType(t: string) {
  switch (t) {
    case 'text':
      return 'Text';
    case 'number':
      return 'Number';
    case 'single_select':
      return 'Single-select';
    case 'multi_select':
      return 'Multi-select';
    default:
      return t;
  }
}

function renderValue(v: ItemAttributeValueRead, allAttrs: AttributeListItem[] | undefined) {
  if (v.valueText) return v.valueText;
  if (v.valueNumber !== null)
    return `${v.valueNumber}${v.attrUnit ? ` ${v.attrUnit}` : ''}`;
  if (v.valueOptionIds?.length && v.attributeId) {
    const attr = allAttrs?.find((a) => a.id === v.attributeId);
    if (!attr) return v.valueOptionIds.join(', ');
    return v.valueOptionIds
      .map((id) => attr.options.find((o) => o.id === id)?.value ?? id)
      .join(', ');
  }
  return '—';
}

function AddValueDialog({
  open,
  mode,
  onOpenChange,
  attributes,
  attachedAttributeIds,
  itemId,
  onAdded,
}: {
  open: boolean;
  mode: 'library' | 'custom';
  onOpenChange: (open: boolean) => void;
  attributes: AttributeListItem[];
  attachedAttributeIds: Set<string>;
  itemId: string;
  onAdded: () => void;
}) {
  const api = useApiClient();
  const [pickedId, setPickedId] = useState('');
  const [customName, setCustomName] = useState('');
  const [valueText, setValueText] = useState('');
  const [valueNumber, setValueNumber] = useState('');
  const [valueOptionIds, setValueOptionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const picked = attributes.find((a) => a.id === pickedId);
  const available = attributes.filter((a) => !attachedAttributeIds.has(a.id));

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'library') {
        if (!picked) throw new Error('Pick an attribute');
        return api.inventory.addAttributeValue(itemId, {
          attributeId: picked.id,
          valueText: picked.type === 'text' ? valueText : undefined,
          valueNumber: picked.type === 'number' ? Number(valueNumber) : undefined,
          valueOptionIds:
            picked.type === 'single_select' || picked.type === 'multi_select'
              ? valueOptionIds
              : undefined,
        });
      }
      return api.inventory.addAttributeValue(itemId, {
        customName: customName.trim(),
        valueText: valueText.trim(),
      });
    },
    onSuccess: () => {
      reset();
      onAdded();
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to add'),
  });

  function reset() {
    setPickedId('');
    setCustomName('');
    setValueText('');
    setValueNumber('');
    setValueOptionIds([]);
    setError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'library' ? 'Add attribute from library' : 'Add custom attribute'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'library' && (
            <>
              <div className="space-y-2">
                <Label>Attribute</Label>
                <Select value={pickedId} onValueChange={setPickedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.length === 0 && (
                      <SelectItem value="__none" disabled>
                        All attributes already attached
                      </SelectItem>
                    )}
                    {available.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({labelForType(a.type)}
                        {a.unit ? `, ${a.unit}` : ''})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {picked?.type === 'text' && (
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input value={valueText} onChange={(e) => setValueText(e.target.value)} required />
                </div>
              )}
              {picked?.type === 'number' && (
                <div className="space-y-2">
                  <Label>Value{picked.unit ? ` (${picked.unit})` : ''}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={valueNumber}
                    onChange={(e) => setValueNumber(e.target.value)}
                    required
                  />
                </div>
              )}
              {picked?.type === 'single_select' && (
                <div className="space-y-2">
                  <Label>Option</Label>
                  <Select
                    value={valueOptionIds[0] ?? ''}
                    onValueChange={(v) => setValueOptionIds([v])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {picked.options.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {picked?.type === 'multi_select' && (
                <div className="space-y-2">
                  <Label>Options (Cmd/Ctrl-click to multi-select)</Label>
                  <select
                    multiple
                    className="h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={valueOptionIds}
                    onChange={(e) =>
                      setValueOptionIds(Array.from(e.target.selectedOptions, (o) => o.value))
                    }
                  >
                    {picked.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.value}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          {mode === 'custom' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="custom-name">Name</Label>
                <Input
                  id="custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Source mill"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-value">Value</Label>
                <Input
                  id="custom-value"
                  value={valueText}
                  onChange={(e) => setValueText(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Custom values stay on this item only. Promote a custom attribute by creating it in
                the library and attaching it instead.
              </p>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
