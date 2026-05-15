import { useState, type FormEvent, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type CategoryWithSubcategories } from '@auction/api-client';
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

type DeleteTarget =
  | { kind: 'category'; id: string; name: string }
  | { kind: 'subcategory'; id: string; name: string; categoryName: string };

export function CategoriesPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: KEY, queryFn: () => api.inventory.listCategories() });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openCat, setOpenCat] = useState(false);
  const [openSubFor, setOpenSubFor] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: KEY });
  }

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.inventory.deleteCategory(id),
    onSuccess: invalidate,
  });
  const deleteSubcategoryMutation = useMutation({
    mutationFn: (id: string) => api.inventory.deleteSubcategory(id),
    onSuccess: invalidate,
  });

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'category') {
      await deleteCategoryMutation.mutateAsync(deleteTarget.id);
    } else {
      await deleteSubcategoryMutation.mutateAsync(deleteTarget.id);
    }
    setDeleteTarget(null);
  }

  const deleteBusy =
    deleteCategoryMutation.isPending || deleteSubcategoryMutation.isPending;
  const deleteError: Error | null =
    deleteCategoryMutation.error ?? deleteSubcategoryMutation.error ?? null;

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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
              Collapse all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setExpanded(new Set((cats.data ?? []).map((c) => c.id)))
              }
            >
              Expand all
            </Button>
          </div>
        </div>

        {cats.error && (
          <p className="text-sm text-destructive">
            {cats.error instanceof ApiError ? cats.error.message : 'Failed to load'}
          </p>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Inventory tree</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {cats.isLoading && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>
            )}
            {cats.data && cats.data.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No categories yet. Add one to get started.
              </p>
            )}

            {cats.data?.map((c) => (
              <CategoryNode
                key={c.id}
                category={c}
                expanded={expanded.has(c.id)}
                onToggle={() => toggle(c.id)}
                onAddSubcategory={() => setOpenSubFor({ id: c.id, name: c.name })}
                onDeleteCategory={() =>
                  setDeleteTarget({ kind: 'category', id: c.id, name: c.name })
                }
                onDeleteSubcategory={(s) =>
                  setDeleteTarget({
                    kind: 'subcategory',
                    id: s.id,
                    name: s.name,
                    categoryName: c.name,
                  })
                }
              />
            ))}

            <button
              type="button"
              onClick={() => setOpenCat(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <span aria-hidden="true">+</span> Add category
            </button>
          </CardContent>
        </Card>
      </div>

      <CategoryDialog
        open={openCat}
        onOpenChange={setOpenCat}
        onCreated={(id) => {
          invalidate();
          // Auto-expand the freshly created category so the user sees the
          // empty subcategory slot immediately.
          setExpanded((prev) => new Set(prev).add(id));
        }}
      />
      <SubcategoryDialog
        open={!!openSubFor}
        categoryId={openSubFor?.id ?? null}
        categoryName={openSubFor?.name ?? ''}
        onOpenChange={(open) => !open && setOpenSubFor(null)}
        onCreated={invalidate}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            deleteCategoryMutation.reset();
            deleteSubcategoryMutation.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete{' '}
              {deleteTarget?.kind === 'category' ? 'category' : 'subcategory'}?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.kind === 'category' ? (
                <>
                  This permanently removes <strong>{deleteTarget.name}</strong>. The
                  category has no subcategories, so nothing else will be affected.
                </>
              ) : deleteTarget?.kind === 'subcategory' ? (
                <>
                  This permanently removes <strong>{deleteTarget.name}</strong> from{' '}
                  <strong>{deleteTarget.categoryName}</strong>.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">
              {deleteError instanceof ApiError ? deleteError.message : 'Failed to delete'}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteBusy}
            >
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function CategoryNode({
  category,
  expanded,
  onToggle,
  onAddSubcategory,
  onDeleteCategory,
  onDeleteSubcategory,
}: {
  category: CategoryWithSubcategories;
  expanded: boolean;
  onToggle: () => void;
  onAddSubcategory: () => void;
  onDeleteCategory: () => void;
  onDeleteSubcategory: (s: { id: string; name: string }) => void;
}) {
  const canDeleteCategory = category.subcategories.length === 0;
  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-secondary"
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <Chevron expanded={expanded} />
          <span className="flex-1 truncate font-medium">{category.name}</span>
        </button>
        <span className="shrink-0 text-xs text-muted-foreground">
          {category.subcategories.length} sub · {category.itemCount} item
          {category.itemCount === 1 ? '' : 's'}
        </span>
        {canDeleteCategory && (
          <DeleteIconButton
            label={`Delete category "${category.name}"`}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCategory();
            }}
          />
        )}
      </div>

      <div
        aria-hidden={!expanded}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <ul
            key={expanded ? 'open' : 'closed'}
            className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-2"
          >
            {category.subcategories.length === 0 && (
              <li className="animate-in fade-in slide-in-from-top-1 px-3 py-1.5 text-xs text-muted-foreground duration-200 fill-mode-both">
                No subcategories yet.
              </li>
            )}
            {category.subcategories.map((s, i) => (
              <li
                key={s.id}
                style={{ animationDelay: `${i * 25}ms` }}
                className="group flex animate-in items-center gap-2 rounded-md fade-in slide-in-from-top-1 duration-200 fill-mode-both transition-colors hover:bg-secondary"
              >
                <Link
                  to={`/items?subcategoryId=${s.id}`}
                  className="flex flex-1 items-center justify-between px-3 py-1.5 text-sm"
                >
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.itemCount}
                  </span>
                </Link>
                {s.itemCount === 0 && (
                  <DeleteIconButton
                    label={`Delete subcategory "${s.name}"`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSubcategory(s);
                    }}
                  />
                )}
              </li>
            ))}
            <li
              style={{ animationDelay: `${category.subcategories.length * 25}ms` }}
              className="animate-in fade-in slide-in-from-top-1 duration-200 fill-mode-both"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubcategory();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <span aria-hidden="true">+</span> Add subcategory
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function DeleteIconButton({
  label,
  onClick,
}: {
  label: string;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
        expanded && 'rotate-90 text-foreground',
      )}
      aria-hidden="true"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
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
