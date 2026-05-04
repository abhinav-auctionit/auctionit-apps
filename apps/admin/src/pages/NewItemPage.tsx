import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import { uomSchema, type Uom } from '@auction/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const UOMS = uomSchema.options;

export function NewItemPage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const cats = useQuery({
    queryKey: ['taxonomy', 'categories'],
    queryFn: () => api.taxonomy.listCategories(),
  });

  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [name, setName] = useState('');
  const [uom, setUom] = useState<Uom>('MT');
  const [hsn, setHsn] = useState('');
  const [benchmark, setBenchmark] = useState('');
  const [error, setError] = useState<string | null>(null);

  const subcategories = useMemo(() => {
    if (!cats.data || !categoryId) return [];
    return cats.data.find((c) => c.id === categoryId)?.subcategories ?? [];
  }, [cats.data, categoryId]);

  const suggestions = useQuery({
    queryKey: ['taxonomy', 'suggestedAttributes', subcategoryId],
    queryFn: () => api.taxonomy.suggestedAttributes(subcategoryId),
    enabled: !!subcategoryId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.taxonomy.createItem({
        subcategoryId,
        name: name.trim(),
        uom,
        hsnCode: hsn.trim() ? hsn.trim() : undefined,
        benchmarkCents: benchmark ? Math.round(Number(benchmark) * 100) : undefined,
      }),
    onSuccess: (item) => navigate(`/items/${item.id}`),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create item'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subcategoryId) {
      setError('Please pick a subcategory');
      return;
    }
    mutation.mutate();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Items › New</p>
            <h1 className="text-2xl font-semibold">New item</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/items')}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save item'}
            </Button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Where does it live
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.data?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!categoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder={categoryId ? 'Select subcategory' : 'Pick category first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Basics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-name">Item name</Label>
                <Input
                  id="item-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HR Coil End Cut"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Unit of measure</Label>
                <Select value={uom} onValueChange={(v) => setUom(v as Uom)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UOMS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hsn">HSN code (optional)</Label>
                <Input
                  id="hsn"
                  value={hsn}
                  onChange={(e) => setHsn(e.target.value)}
                  placeholder="4, 6, or 8 digits"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benchmark">Latest benchmark ₹ (optional)</Label>
                <Input
                  id="benchmark"
                  type="number"
                  inputMode="decimal"
                  value={benchmark}
                  onChange={(e) => setBenchmark(e.target.value)}
                  placeholder="38000"
                />
              </div>
            </CardContent>
          </Card>

          {subcategoryId && suggestions.data && (
            <Card className="bg-muted/40">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  <span>Suggested attributes</span>
                  <span className="text-primary">
                    {suggestions.data.attributes.length > 0
                      ? 'Common in this subcategory'
                      : 'No usage data yet'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {suggestions.data.attributes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Once items have attributes here, suggestions will surface. Add attribute values
                    after creating this item from its detail page.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.data.attributes.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-2 rounded-full border border-dashed border-primary/40 bg-background px-3 py-1 text-sm"
                      >
                        <span className="text-primary">+</span>
                        {a.name}
                        <span className="text-xs text-muted-foreground">
                          {a.used}/{suggestions.data.total}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Save the item first, then attach attribute values from its detail page.
                </p>
              </CardContent>
            </Card>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </div>
    </AppShell>
  );
}
