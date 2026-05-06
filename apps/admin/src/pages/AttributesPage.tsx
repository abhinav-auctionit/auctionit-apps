import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type { AttributeType } from '@auction/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
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
  Textarea,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const KEY = ['inventory', 'attributes'] as const;

const TYPES: { value: AttributeType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'single_select', label: 'Single-select' },
  { value: 'multi_select', label: 'Multi-select' },
];

export function AttributesPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const attrs = useQuery({ queryKey: KEY, queryFn: () => api.inventory.listAttributes() });
  const [filter, setFilter] = useState<AttributeType | 'all'>('all');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!attrs.data) return [];
    return filter === 'all' ? attrs.data : attrs.data.filter((a) => a.type === filter);
  }, [attrs.data, filter]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Attributes</h1>
            <p className="text-sm text-muted-foreground">
              Reusable definitions you can attach to any item.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>+ New attribute</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All ({attrs.data?.length ?? 0})
          </FilterChip>
          {TYPES.map((t) => (
            <FilterChip key={t.value} active={filter === t.value} onClick={() => setFilter(t.value)}>
              {t.label}
            </FilterChip>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Used in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attrs.isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!attrs.isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No attributes yet.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      {a.description && (
                        <div className="text-xs text-muted-foreground">{a.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{labelFor(a.type)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{a.unit ?? '—'}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {a.usedIn} item{a.usedIn === 1 ? '' : 's'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <NewAttributeDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: KEY })}
      />
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function labelFor(t: AttributeType) {
  return TYPES.find((x) => x.value === t)?.label ?? t;
}

function NewAttributeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const api = useApiClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<AttributeType>('single_select');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [optionsRaw, setOptionsRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isSelect = type === 'single_select' || type === 'multi_select';
  const isNumber = type === 'number';

  const mutation = useMutation({
    mutationFn: () =>
      api.inventory.createAttribute({
        name: name.trim(),
        type,
        unit: isNumber && unit.trim() ? unit.trim() : undefined,
        description: description.trim() ? description.trim() : undefined,
        options: isSelect
          ? optionsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
          : undefined,
      }),
    onSuccess: () => {
      reset();
      onCreated();
      onOpenChange(false);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to create attribute'),
  });

  function reset() {
    setName('');
    setType('single_select');
    setUnit('');
    setDescription('');
    setOptionsRaw('');
    setError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New attribute</DialogTitle>
          <DialogDescription>
            Defines a reusable field. Values are set per item. Type is locked once created.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="attr-name">Name</Label>
            <Input id="attr-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    type === t.value
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:border-foreground/40'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {isNumber && (
            <div className="space-y-2">
              <Label htmlFor="attr-unit">Unit</Label>
              <Input
                id="attr-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="mm, kg, %, …"
              />
            </div>
          )}

          {isSelect && (
            <div className="space-y-2">
              <Label htmlFor="attr-options">Options (one per line)</Label>
              <Textarea
                id="attr-options"
                value={optionsRaw}
                onChange={(e) => setOptionsRaw(e.target.value)}
                placeholder="Mill scale, no rust&#10;Light surface rust&#10;Heavy rust"
                rows={5}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="attr-desc">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="attr-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Plate / sheet thickness"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <p className="text-xs text-muted-foreground">Type can&apos;t be changed later.</p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create attribute'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

