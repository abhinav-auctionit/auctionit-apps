import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const KEY = ['taxonomy', 'categories'] as const;

export function CategoriesPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: KEY, queryFn: () => api.taxonomy.listCategories() });

  const [openCat, setOpenCat] = useState(false);
  const [openSub, setOpenSub] = useState<{ categoryId: string } | null>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: KEY });
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
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
          <Button onClick={() => setOpenCat(true)}>+ Add category</Button>
        </div>

        {cats.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {cats.error && (
          <p className="text-sm text-destructive">
            {cats.error instanceof ApiError ? cats.error.message : 'Failed to load'}
          </p>
        )}

        {cats.data && cats.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No categories yet. Add one to get started.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cats.data?.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <Badge variant="secondary">{c.itemCount} items</Badge>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {c.subcategories.length === 0 && (
                  <p className="text-sm text-muted-foreground">No subcategories yet.</p>
                )}
                {c.subcategories.map((s) => (
                  <Link
                    key={s.id}
                    to={`/items?subcategoryId=${s.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                  >
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">{s.itemCount}</span>
                  </Link>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setOpenSub({ categoryId: c.id })}
                >
                  + Add subcategory
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <CategoryDialog
        open={openCat}
        onOpenChange={setOpenCat}
        onCreated={invalidate}
      />
      <SubcategoryDialog
        open={!!openSub}
        categoryId={openSub?.categoryId ?? null}
        categories={cats.data ?? []}
        onOpenChange={(open) => !open && setOpenSub(null)}
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
  onCreated: () => void;
}) {
  const api = useApiClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (n: string) => api.taxonomy.createCategory({ name: n }),
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
  categories,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  categoryId: string | null;
  categories: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const api = useApiClient();
  const [name, setName] = useState('');
  const [pickedCategoryId, setPickedCategoryId] = useState<string | null>(categoryId);
  const [error, setError] = useState<string | null>(null);

  const effectiveCategoryId = pickedCategoryId ?? categoryId;

  const mutation = useMutation({
    mutationFn: (input: { categoryId: string; name: string }) =>
      api.taxonomy.createSubcategory(input),
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
    if (!effectiveCategoryId || !name.trim()) return;
    mutation.mutate({ categoryId: effectiveCategoryId, name: name.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New subcategory</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={effectiveCategoryId ?? undefined}
              onValueChange={(v) => setPickedCategoryId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-name">Name</Label>
            <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} required />
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
