import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
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
  Input,
  Label,
  cn,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const KEY = ['inventory', 'categories'] as const;

export function CategoriesPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: KEY, queryFn: () => api.inventory.listCategories() });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState(false);
  const [openSub, setOpenSub] = useState(false);

  // Default-select the first category once data lands or current selection disappears.
  useEffect(() => {
    if (!cats.data || cats.data.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !cats.data.some((c) => c.id === selectedId)) {
      setSelectedId(cats.data[0]!.id);
    }
  }, [cats.data, selectedId]);

  const selected = cats.data?.find((c) => c.id === selectedId) ?? null;

  function invalidate() {
    qc.invalidateQueries({ queryKey: KEY });
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            {cats.data
              ? `${cats.data.length} categor${cats.data.length === 1 ? 'y' : 'ies'} · ${cats.data.reduce(
                  (n, c) => n + c.subcategories.length,
                  0,
                )} subcategories`
              : 'Loading…'}
          </p>
        </div>

        {cats.error && (
          <p className="text-sm text-destructive">
            {cats.error instanceof ApiError ? cats.error.message : 'Failed to load'}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {cats.isLoading && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>
              )}
              {cats.data && cats.data.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No categories yet.</p>
              )}
              {cats.data?.map((c) => {
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'hover:bg-secondary',
                    )}
                  >
                    <span className="truncate">{c.name}</span>
                    <span
                      className={cn(
                        'shrink-0 text-xs',
                        active ? 'text-primary/80' : 'text-muted-foreground',
                      )}
                    >
                      {c.itemCount}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setOpenCat(true)}
                className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                + Add category
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selected ? `Subcategories of ${selected.name}` : 'Subcategories'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {!selected && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  Select a category to see its subcategories.
                </p>
              )}
              {selected && selected.subcategories.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  No subcategories yet.
                </p>
              )}
              {selected?.subcategories.map((s) => (
                <Link
                  key={s.id}
                  to={`/items?subcategoryId=${s.id}`}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary"
                >
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.itemCount}</span>
                </Link>
              ))}
              {selected && (
                <button
                  type="button"
                  onClick={() => setOpenSub(true)}
                  className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  + Add subcategory
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CategoryDialog
        open={openCat}
        onOpenChange={setOpenCat}
        onCreated={(id) => {
          invalidate();
          setSelectedId(id);
        }}
      />
      <SubcategoryDialog
        open={openSub}
        categoryId={selectedId}
        categoryName={selected?.name ?? ''}
        onOpenChange={setOpenSub}
        onCreated={invalidate}
      />
    </AppShell>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const api = useApiClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (n: string) => api.inventory.createCategory({ name: n }),
    onSuccess: (created) => {
      setName('');
      onCreated(created.id);
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    mutation.mutate(name.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>A top-level grouping for inventory.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubcategoryDialog({
  open,
  categoryId,
  categoryName,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const api = useApiClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { categoryId: string; name: string }) =>
      api.inventory.createSubcategory(input),
    onSuccess: () => {
      setName('');
      onCreated();
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId || !name.trim()) return;
    mutation.mutate({ categoryId, name: name.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New subcategory</DialogTitle>
          <DialogDescription>
            {categoryName ? `Adding to ${categoryName}.` : 'Pick a category first.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sub-name">Name</Label>
            <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !categoryId}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
