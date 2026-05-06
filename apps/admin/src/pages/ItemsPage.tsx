import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

export function ItemsPage() {
  const api = useApiClient();
  const [params, setParams] = useSearchParams();
  const subcategoryId = params.get('subcategoryId') ?? undefined;
  const categoryId = params.get('categoryId') ?? undefined;

  const cats = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: () => api.inventory.listCategories(),
  });
  const items = useQuery({
    queryKey: ['inventory', 'items', { subcategoryId, categoryId }],
    queryFn: () => api.inventory.listItems({ subcategoryId, categoryId }),
  });

  const subcategoryName = useMemo(() => {
    if (!subcategoryId || !cats.data) return null;
    for (const c of cats.data) {
      const s = c.subcategories.find((s) => s.id === subcategoryId);
      if (s) return `${c.name} › ${s.name}`;
    }
    return null;
  }, [cats.data, subcategoryId]);

  function clearFilters() {
    setParams({});
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Items{' '}
              {items.data && (
                <span className="text-base font-normal text-muted-foreground">
                  ({items.data.length})
                </span>
              )}
            </h1>
            {subcategoryName && (
              <p className="text-sm text-muted-foreground">Filtered by {subcategoryName}</p>
            )}
          </div>
          <Link to="/items/new">
            <Button>+ Add item</Button>
          </Link>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={!subcategoryId && !categoryId}
            onClick={() => setParams({})}
          >
            All
          </FilterChip>
          {cats.data?.map((c) => (
            <FilterChip
              key={c.id}
              active={categoryId === c.id}
              onClick={() => setParams({ categoryId: c.id })}
            >
              {c.name} ({c.itemCount})
            </FilterChip>
          ))}
        </div>

        {(subcategoryId || categoryId) && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Active filter:</span>
            <Badge variant="secondary" className="gap-1">
              {subcategoryName ?? cats.data?.find((c) => c.id === categoryId)?.name}
              <button
                onClick={clearFilters}
                className="ml-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear filter"
              >
                ×
              </button>
            </Badge>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">Item</TableHead>
                  <TableHead>Key attributes</TableHead>
                  <TableHead className="w-[80px]">UOM</TableHead>
                  <TableHead className="w-[110px]">HSN</TableHead>
                  <TableHead className="w-[120px] text-right">Benchmark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {items.error && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-destructive">
                      {items.error instanceof ApiError ? items.error.message : 'Failed to load'}
                    </TableCell>
                  </TableRow>
                )}
                {!items.isLoading && items.data && items.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No items match.
                    </TableCell>
                  </TableRow>
                )}
                {items.data?.map((it) => (
                  <TableRow key={it.id} className="cursor-pointer">
                    <TableCell>
                      <Link to={`/items/${it.id}`} className="block">
                        <div className="font-medium">{it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.categoryName} › {it.subcategoryName}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {it.attributeValues.slice(0, 3).map((v) => (
                          <Badge key={v.id} variant="outline" className="font-mono text-xs">
                            {renderShort(v)}
                          </Badge>
                        ))}
                        {it.attributeValues.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{it.attributeValues.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{it.uom}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {it.hsnCode ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {it.benchmarkCents !== null
                        ? `₹${(it.benchmarkCents / 100).toLocaleString('en-IN')}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
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

function renderShort(v: {
  attrName: string | null;
  customName: string | null;
  attrUnit: string | null;
  valueText: string | null;
  valueNumber: string | null;
  valueOptionIds: string[] | null;
}) {
  if (v.valueText) return v.valueText;
  if (v.valueNumber !== null) return `${v.valueNumber}${v.attrUnit ? ` ${v.attrUnit}` : ''}`;
  if (v.valueOptionIds?.length) return `${v.attrName ?? v.customName ?? '?'} (${v.valueOptionIds.length})`;
  return v.attrName ?? v.customName ?? '—';
}
