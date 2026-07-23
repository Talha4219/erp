'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Building2, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

type BankAccount = {
  id: string; accountName: string; accountNumber: string; sortCode: string | null
  bankName: string; currency: string; accountType: string
  openingBalance: string; currentBalance: string; isActive: boolean
  _count: { statements: number; transactions: number }
}

const TYPE_ICON: Record<string, string> = {
  CURRENT: '🏦', SAVINGS: '💰', CREDIT_CARD: '💳', LOAN: '📋',
}

export default function BankAccountsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Record<string, unknown>>()

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get<BankAccount[]>('/api/finance/bank-accounts').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  const createAccount = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/api/finance/bank-accounts', d),
    onSuccess: () => { toast.success('Bank account created'); qc.invalidateQueries({ queryKey: ['bank-accounts'] }); setShowForm(false); reset() },
    onError: () => toast.error('Failed to create bank account'),
  })

  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.currentBalance), 0)

  if (isLoading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />)}</div>

  return (
    <>
      <PageHeader
        title="Bank Accounts"
        description="Manage company bank accounts and track balances"
        actions={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" />Add Account</Button>}
      />

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground font-medium">Total Cash Position</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
            <p className="text-xs text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground font-medium">Current Accounts</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(accounts.filter(a => a.accountType === 'CURRENT').reduce((s, a) => s + parseFloat(a.currentBalance), 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground font-medium">Savings</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(accounts.filter(a => a.accountType === 'SAVINGS').reduce((s, a) => s + parseFloat(a.currentBalance), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account cards */}
      {accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Building2 className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p>No bank accounts yet. Add your first account to start tracking cash.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc) => {
            const balance = parseFloat(acc.currentBalance)
            const opening = parseFloat(acc.openingBalance)
            const change = balance - opening
            return (
              <Card key={acc.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg">{TYPE_ICON[acc.accountType] ?? '🏦'}</p>
                      <CardTitle className="text-base mt-1">{acc.accountName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{acc.bankName}</p>
                    </div>
                    <Badge variant="outline">{acc.accountType.replace('_', ' ')}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(balance, acc.currency)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {change >= 0
                      ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                      : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                    <span className={`text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {change >= 0 ? '+' : ''}{formatCurrency(change, acc.currency)} since opening
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block font-medium text-foreground">{acc.accountNumber}</span>
                      {acc.sortCode && <span>Sort: {acc.sortCode}</span>}
                    </div>
                    <div className="text-right">
                      <span className="block">{acc._count.statements} stmt{acc._count.statements !== 1 ? 's' : ''}</span>
                      <span className="block">{acc._count.transactions} txn{acc._count.transactions !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); reset() } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createAccount.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Account Name *</Label>
                <Input {...register('accountName', { required: true })} placeholder="e.g. Main Current Account" />
                {errors.accountName && <p className="text-xs text-red-500">Required</p>}
              </div>
              <div className="space-y-1">
                <Label>Account Number *</Label>
                <Input {...register('accountNumber', { required: true })} placeholder="12345678" />
              </div>
              <div className="space-y-1">
                <Label>Sort Code</Label>
                <Input {...register('sortCode')} placeholder="01-02-03" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Bank Name *</Label>
                <Input {...register('bankName', { required: true })} placeholder="e.g. Barclays" />
              </div>
              <div className="space-y-1">
                <Label>Account Type</Label>
                <Select defaultValue="CURRENT" onValueChange={(v) => setValue('accountType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['CURRENT','SAVINGS','CREDIT_CARD','LOAN'].map((t) => <SelectItem key={t} value={t}>{t.replace('_',' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Select defaultValue="GBP" onValueChange={(v) => setValue('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['GBP','USD','EUR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Opening Balance</Label>
                <Input {...register('openingBalance', { valueAsNumber: true })} type="number" step="0.01" defaultValue={0} />
              </div>
              <div className="space-y-1">
                <Label>GL Account Code</Label>
                <Input {...register('glAccountCode')} placeholder="e.g. 1100" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createAccount.isPending}>{createAccount.isPending ? 'Saving…' : 'Add Account'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
