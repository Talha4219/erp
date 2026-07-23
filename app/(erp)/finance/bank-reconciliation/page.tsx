'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  ArrowLeft, Zap, CheckCircle2, XCircle, Link2, Unlink2,
  TrendingUp, TrendingDown, FileText, AlertCircle, Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/utils'

type BankAccount = { id: string; accountName: string; bankName: string; currency: string; currentBalance: string }

type Statement = {
  id: string
  statementDate: string
  openingBalance: string
  closingBalance: string
  isReconciled: boolean
  bankAccountId: string
  bankAccount: { accountName: string; currency: string }
  _count: { lines: number }
}

type StatementLine = {
  id: string
  transactionDate: string
  description: string
  amount: string
  isCredit: boolean
  reference: string | null
  isMatched: boolean
  matchedPaymentId: string | null
  matchedJournalId: string | null
}

type StatementDetail = {
  id: string
  statementDate: string
  openingBalance: string
  closingBalance: string
  isReconciled: boolean
  bankAccount: { accountName: string; currency: string; bankName: string }
  lines: StatementLine[]
}

export default function BankReconciliationPage() {
  const qc = useQueryClient()
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all')
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null)
  const [matchDialog, setMatchDialog] = useState<{ lineId: string; isCredit: boolean } | null>(null)
  const [manualPaymentId, setManualPaymentId] = useState('')
  const [manualJournalId, setManualJournalId] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    bankAccountId: '', statementDate: '', openingBalance: '', closingBalance: '',
  })
  const [csvText, setCsvText] = useState('')

  // Accounts list
  const { data: accounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get<BankAccount[]>('/api/finance/bank-accounts').then((r) => r.data ?? []),
    placeholderData: (previousData) => previousData,
  })

  // Statements list
  const { data: statements = [], isLoading: loadingStatements } = useQuery({
    queryKey: ['bank-statements', selectedAccountId],
    queryFn: () => {
      const qs = selectedAccountId !== 'all' ? `?bankAccountId=${selectedAccountId}` : ''
      return api.get<Statement[]>(`/api/finance/bank-statements${qs}`).then((r) => r.data ?? [])
    },
    placeholderData: (previousData) => previousData,
  })

  // Statement detail
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['bank-statement-detail', selectedStatementId],
    queryFn: () =>
      api.get<StatementDetail>(`/api/finance/bank-statements/${selectedStatementId}`).then((r) => r.data!),
    enabled: !!selectedStatementId,
  })

  // Auto-match
  const autoMatch = useMutation({
    mutationFn: (id: string) => api.post(`/api/finance/bank-statements/${id}/match`, {}),
    onSuccess: (res) => {
      const d = (res as { data?: { matchedCount: number; unmatched: number } }).data
      toast.success(`Matched ${d?.matchedCount ?? 0} lines. ${d?.unmatched ?? 0} unmatched remaining.`)
      qc.invalidateQueries({ queryKey: ['bank-statement-detail', selectedStatementId] })
      qc.invalidateQueries({ queryKey: ['bank-statements'] })
    },
    onError: () => toast.error('Auto-match failed'),
  })

  // Manual match
  const manualMatch = useMutation({
    mutationFn: (body: { lineId: string; matchedPaymentId?: string; matchedJournalId?: string }) =>
      api.post(`/api/finance/bank-statements/${selectedStatementId}/match`, body),
    onSuccess: () => {
      toast.success('Line matched')
      setMatchDialog(null)
      setManualPaymentId('')
      setManualJournalId('')
      qc.invalidateQueries({ queryKey: ['bank-statement-detail', selectedStatementId] })
      qc.invalidateQueries({ queryKey: ['bank-statements'] })
    },
    onError: () => toast.error('Match failed'),
  })

  // Unmatch
  const unmatch = useMutation({
    mutationFn: (lineId: string) =>
      api.delete(`/api/finance/bank-statements/${selectedStatementId}/match?lineId=${lineId}`),
    onSuccess: () => {
      toast.success('Match removed')
      qc.invalidateQueries({ queryKey: ['bank-statement-detail', selectedStatementId] })
      qc.invalidateQueries({ queryKey: ['bank-statements'] })
    },
    onError: () => toast.error('Unmatch failed'),
  })

  // Upload statement (manual CSV parse)
  const uploadStatement = useMutation({
    mutationFn: (body: object) => api.post('/api/finance/bank-statements', body),
    onSuccess: () => {
      toast.success('Statement uploaded')
      qc.invalidateQueries({ queryKey: ['bank-statements'] })
      setShowUpload(false)
      setCsvText('')
      setUploadForm({ bankAccountId: '', statementDate: '', openingBalance: '', closingBalance: '' })
    },
    onError: () => toast.error('Upload failed'),
  })

  function parseCsvLines(csv: string) {
    return csv.trim().split('\n').map((row) => {
      const [date, description, amount, type, reference] = row.split(',').map((c) => c.trim())
      return {
        transactionDate: date,
        description: description || '',
        amount: Math.abs(parseFloat(amount) || 0),
        isCredit: (type || '').toUpperCase() === 'CR',
        reference: reference || undefined,
      }
    }).filter((l) => l.transactionDate && l.description)
  }

  function handleUploadSubmit() {
    const lines = parseCsvLines(csvText)
    if (!lines.length) { toast.error('No valid lines parsed'); return }
    uploadStatement.mutate({
      bankAccountId: uploadForm.bankAccountId,
      statementDate: uploadForm.statementDate,
      openingBalance: parseFloat(uploadForm.openingBalance) || 0,
      closingBalance: parseFloat(uploadForm.closingBalance) || 0,
      lines,
    })
  }

  // ── Statement detail view ──────────────────────────────────────────────
  if (selectedStatementId) {
    if (loadingDetail || !detail) {
      return <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />)}</div>
    }

    const matched = detail.lines.filter((l) => l.isMatched)
    const unmatched = detail.lines.filter((l) => !l.isMatched)
    const matchedTotal = matched.reduce((s, l) => s + parseFloat(l.amount), 0)
    const unmatchedTotal = unmatched.reduce((s, l) => s + parseFloat(l.amount), 0)
    const currency = detail.bankAccount.currency

    return (
      <>
        <PageHeader
          title={`Reconcile: ${detail.bankAccount.accountName}`}
          description={`${detail.bankAccount.bankName} · Statement ${formatDate(detail.statementDate)}`}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedStatementId(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" />Back
              </Button>
              <Button
                onClick={() => autoMatch.mutate(selectedStatementId)}
                disabled={autoMatch.isPending || detail.isReconciled}
              >
                <Zap className="h-4 w-4 mr-1" />
                {autoMatch.isPending ? 'Matching…' : 'Auto-Match All'}
              </Button>
            </div>
          }
        />

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">Opening Balance</p>
              <p className="text-lg font-bold">{formatCurrency(parseFloat(detail.openingBalance), currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">Closing Balance</p>
              <p className="text-lg font-bold">{formatCurrency(parseFloat(detail.closingBalance), currency)}</p>
            </CardContent>
          </Card>
          <Card className={unmatched.length === 0 ? 'border-green-300 bg-green-50' : ''}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">Matched</p>
              <p className="text-lg font-bold text-green-700">{matched.length} lines</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(matchedTotal, currency)}</p>
            </CardContent>
          </Card>
          <Card className={unmatched.length > 0 ? 'border-amber-300 bg-amber-50' : ''}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">Unmatched</p>
              <p className={`text-lg font-bold ${unmatched.length > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                {unmatched.length} lines
              </p>
              <p className="text-xs text-muted-foreground">{formatCurrency(unmatchedTotal, currency)}</p>
            </CardContent>
          </Card>
        </div>

        {detail.isReconciled && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-green-800 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            This statement is fully reconciled
          </div>
        )}

        {/* Lines table */}
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Reference</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Type</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Matched To</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {detail.lines.map((line) => (
                <tr
                  key={line.id}
                  className={line.isMatched ? 'bg-green-50/40' : 'bg-amber-50/30'}
                >
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(line.transactionDate)}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{line.description}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{line.reference ?? '—'}</td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${line.isCredit ? 'text-green-700' : 'text-red-600'}`}>
                    {line.isCredit ? '+' : '-'}{formatCurrency(parseFloat(line.amount), currency)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {line.isCredit
                      ? <span className="inline-flex items-center gap-1 text-green-700 text-xs"><TrendingUp className="h-3 w-3" />CR</span>
                      : <span className="inline-flex items-center gap-1 text-red-600 text-xs"><TrendingDown className="h-3 w-3" />DR</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {line.isMatched
                      ? <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Matched</Badge>
                      : <Badge variant="outline" className="border-amber-300 text-amber-700"><AlertCircle className="h-3 w-3 mr-1" />Unmatched</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {line.matchedPaymentId && (
                      <span className="flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        Payment: {line.matchedPaymentId.slice(0, 8)}…
                      </span>
                    )}
                    {line.matchedJournalId && (
                      <span className="flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        Journal: {line.matchedJournalId.slice(0, 8)}…
                      </span>
                    )}
                    {!line.matchedPaymentId && !line.matchedJournalId && '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {line.isMatched ? (
                      <Button
                        size="sm" variant="ghost"
                        className="text-muted-foreground h-7 px-2"
                        onClick={() => unmatch.mutate(line.id)}
                        disabled={unmatch.isPending}
                      >
                        <Unlink2 className="h-3.5 w-3.5 mr-1" />Unmatch
                      </Button>
                    ) : (
                      <Button
                        size="sm" variant="outline"
                        className="h-7 px-2"
                        onClick={() => setMatchDialog({ lineId: line.id, isCredit: line.isCredit })}
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1" />Match
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {detail.lines.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No lines in this statement</div>
          )}
        </div>

        {/* Manual match dialog */}
        <Dialog open={!!matchDialog} onOpenChange={(o) => { if (!o) { setMatchDialog(null); setManualPaymentId(''); setManualJournalId('') } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Manual Match</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Enter a Payment ID or Journal Entry ID to match this line.</p>
              <div className="space-y-1">
                <label className="text-xs font-medium">Payment ID</label>
                <Input
                  placeholder="cuid of CustomerPayment or VendorPayment"
                  value={manualPaymentId}
                  onChange={(e) => setManualPaymentId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Journal Entry ID</label>
                <Input
                  placeholder="cuid of JournalEntry"
                  value={manualJournalId}
                  onChange={(e) => setManualJournalId(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">At least one ID is required.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMatchDialog(null)}>Cancel</Button>
              <Button
                disabled={(!manualPaymentId && !manualJournalId) || manualMatch.isPending}
                onClick={() => {
                  if (!matchDialog) return
                  manualMatch.mutate({
                    lineId: matchDialog.lineId,
                    matchedPaymentId: manualPaymentId || undefined,
                    matchedJournalId: manualJournalId || undefined,
                  })
                }}
              >
                {manualMatch.isPending ? 'Saving…' : 'Confirm Match'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // ── Statement list view ────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Bank Reconciliation"
        description="Match bank statement lines to payments and journal entries"
        actions={
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4 mr-1" />Upload Statement
          </Button>
        }
      />

      {/* Filter by account */}
      <div className="mb-4 flex items-center gap-3">
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{statements.length} statement{statements.length !== 1 ? 's' : ''}</span>
      </div>

      {loadingStatements ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />)}</div>
      ) : statements.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">No statements uploaded yet</p>
          <p className="text-sm mt-1">Upload a bank statement to start reconciling</p>
          <Button className="mt-4" onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4 mr-1" />Upload Statement
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Bank Account</th>
                <th className="px-4 py-3 text-left">Statement Date</th>
                <th className="px-4 py-3 text-right">Opening</th>
                <th className="px-4 py-3 text-right">Closing</th>
                <th className="px-4 py-3 text-center">Lines</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {statements.map((stmt) => {
                const diff = parseFloat(stmt.closingBalance) - parseFloat(stmt.openingBalance)
                return (
                  <tr key={stmt.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{stmt.bankAccount.accountName}</p>
                      <p className="text-xs text-muted-foreground">{stmt.bankAccount.currency}</p>
                    </td>
                    <td className="px-4 py-3">{formatDate(stmt.statementDate)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(parseFloat(stmt.openingBalance), stmt.bankAccount.currency)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className="block">{formatCurrency(parseFloat(stmt.closingBalance), stmt.bankAccount.currency)}</span>
                      <span className={`text-xs ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {diff >= 0 ? '+' : ''}{formatCurrency(diff, stmt.bankAccount.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{stmt._count.lines}</td>
                    <td className="px-4 py-3 text-center">
                      {stmt.isReconciled
                        ? <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Reconciled</Badge>
                        : <Badge variant="outline" className="border-amber-300 text-amber-700"><XCircle className="h-3 w-3 mr-1" />Pending</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedStatementId(stmt.id)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload statement dialog */}
      <Dialog open={showUpload} onOpenChange={(o) => { if (!o) setShowUpload(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Upload Bank Statement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Bank Account *</label>
              <Select value={uploadForm.bankAccountId} onValueChange={(v) => setUploadForm(f => ({ ...f, bankAccountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountName} — {a.bankName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Statement Date *</label>
                <Input type="date" value={uploadForm.statementDate} onChange={(e) => setUploadForm(f => ({ ...f, statementDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Opening Balance</label>
                <Input type="number" step="0.01" placeholder="0.00" value={uploadForm.openingBalance} onChange={(e) => setUploadForm(f => ({ ...f, openingBalance: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Closing Balance</label>
                <Input type="number" step="0.01" placeholder="0.00" value={uploadForm.closingBalance} onChange={(e) => setUploadForm(f => ({ ...f, closingBalance: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Transaction Lines (CSV) *</label>
              <p className="text-xs text-muted-foreground">Format: date, description, amount, CR/DR, reference (one per line)</p>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-xs font-mono h-36 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={'2026-06-01, BACS Payment ERP Ltd, 1250.00, CR, REF001\n2026-06-02, DD Rent, 2500.00, DR, RENT-JUN'}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button
              disabled={!uploadForm.bankAccountId || !uploadForm.statementDate || !csvText || uploadStatement.isPending}
              onClick={handleUploadSubmit}
            >
              {uploadStatement.isPending ? 'Uploading…' : 'Upload & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
