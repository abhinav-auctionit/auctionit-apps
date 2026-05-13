import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type { AuctionType } from '@auction/types';
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
  Textarea,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const TYPES: Array<{ value: AuctionType; label: string }> = [
  { value: 'forward', label: 'Forward (price rises)' },
  { value: 'reverse', label: 'Reverse (price falls)' },
  { value: 'sealed_bid', label: 'Sealed bid' },
  { value: 'yankee', label: 'Yankee' },
];

export function NewAuctionPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const clients = useQuery({
    queryKey: ['admin', 'clients'],
    queryFn: () => api.adminClients.list(),
  });

  const [clientId, setClientId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [auctionType, setAuctionType] = useState<AuctionType>('forward');
  const [emd, setEmd] = useState('0');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.adminAuctions.create({
        clientId,
        code: code.trim(),
        name: name.trim(),
        auctionType,
        emdAmount: Number(emd) || 0,
        description: description.trim() || null,
      }),
    onSuccess: (auction) => {
      qc.invalidateQueries({ queryKey: ['admin', 'auctions'] });
      navigate(`/auctions/${auction.id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError('Pick a client.');
      return;
    }
    if (!code.trim() || !name.trim()) {
      setError('Code and name are required.');
      return;
    }
    create.mutate();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Auctions › New
            </p>
            <h1 className="text-2xl font-semibold">New auction</h1>
            <p className="text-sm text-muted-foreground">
              Create the auction container. You&apos;ll add lots on the next page.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Basics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="client">
                  Client <span className="text-destructive">*</span>
                </Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select the seller" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.data
                      ?.filter((c) => c.isActive)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {clients.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No clients onboarded yet. Create one under Clients › Onboard client.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">
                  Auction code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={64}
                  placeholder="e.g. JSW-2026-001"
                  className="font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={auctionType} onValueChange={(v) => setAuctionType(v as AuctionType)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">
                  Auction name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={255}
                  placeholder="e.g. Q2 Scrap Disposal – Bellary Plant"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emd">EMD (₹)</Label>
                <Input
                  id="emd"
                  type="number"
                  min={0}
                  step={1}
                  value={emd}
                  onChange={(e) => setEmd(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Earnest money per bidder. Deducted from wallet on participation.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Any context for bidders — location, material grade, lifting terms, etc."
              />
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => navigate('/auctions')}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create & add lots'}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
