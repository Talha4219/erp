'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  HelpCircle, Search, LayoutDashboard, ShoppingCart, Truck, Warehouse, Users,
  Landmark, UserCheck, Monitor, Settings, Shield, BookOpen,
} from 'lucide-react'

type Section = {
  id: string
  title: string
  icon: React.ElementType
  summary: string
  workflow?: string[]
  pages: Array<{ label: string; desc: string }>
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard,
    summary: 'The first screen after login. Shows revenue, cash position, AR ageing, low-stock alerts, pending approvals ("My Tasks"), and a cross-module activity feed. Widgets can be shown/hidden per user via the dashboard settings icon.',
    pages: [
      { label: 'Workflow Alerts', desc: 'Grouped Approval / Financial / Inventory alerts — click through to act on them.' },
      { label: 'My Tasks', desc: 'Approvals waiting on you specifically, based on your role.' },
      { label: 'Quick Actions', desc: 'One-click shortcuts to create a customer, supplier, quotation, PO, invoice, or employee.' },
    ],
  },
  {
    id: 'sales', title: 'Sales', icon: ShoppingCart,
    summary: 'Revenue engine — from lead to cash collected.',
    workflow: ['Lead / Opportunity (CRM)', 'Quotation', 'Sales Order', 'Delivery Note (stock leaves warehouse)', 'Invoice', 'Payment'],
    pages: [
      { label: 'Customers', desc: 'Customer records; click a customer to open their 360 view — revenue, outstanding balance, open orders, contacts, and full document history in one place.' },
      { label: 'Quotations / Orders', desc: 'Convert a quotation to a sales order once the customer accepts.' },
      { label: 'Delivery Notes', desc: 'Dispatching a delivery note is what actually deducts stock — not creating the sales order.' },
      { label: 'Invoices / Payments', desc: 'Record customer payments here; invoices auto-update to Partially Paid / Paid.' },
      { label: 'Returns', desc: 'Select the original invoice to pull in real line items; mark a return Completed to automatically restock inventory.' },
    ],
  },
  {
    id: 'procurement', title: 'Procurement', icon: Truck,
    summary: 'Everything the company buys, from request to payment.',
    workflow: ['Purchase Request (PR)', 'RFQ (Request for Quotation)', 'Supplier Quotation', 'Purchase Order (PO)', 'Goods Receipt Note (GRN — stock enters warehouse)', 'Vendor Invoice', 'Vendor Payment'],
    pages: [
      { label: 'Purchase Requests', desc: 'Once approved, use "Create RFQ" on the PR to jump straight into sourcing with items pre-filled.' },
      { label: 'RFQs / Quotations', desc: 'Send requirements to suppliers and record their quoted prices.' },
      { label: 'Purchase Orders → Goods Receipt', desc: 'Receiving a GRN against a PO is what adds stock — a PO alone does not.' },
      { label: 'Purchase Invoices', desc: 'Verification & payment control center — 3-way match (PO vs GRN vs Invoice), payment tracking, and posted accounting entries.' },
      { label: 'Returns', desc: 'Pick the source GRN to auto-fill items; marking a return Shipped deducts the returned stock.' },
      { label: 'Vendors / Ratings', desc: 'Supplier directory with contacts and a 5-point rating history feeding the Procurement Dashboard\'s supplier performance chart.' },
    ],
  },
  {
    id: 'inventory', title: 'Inventory', icon: Warehouse,
    summary: 'Stock levels are tracked per item, per warehouse. Every movement is logged in the Stock Ledger for a full audit trail.',
    pages: [
      { label: 'Items', desc: 'Product/material catalog — SKU, category, reorder point, unit of measure.' },
      { label: 'Warehouses / Stock', desc: 'Current on-hand quantities by location.' },
      { label: 'Transfers', desc: 'Move stock between warehouses (deducts source, adds destination).' },
      { label: 'Cycle Counts', desc: 'Physical stock counts that reconcile system quantity to what\'s actually on the shelf.' },
    ],
  },
  {
    id: 'hr', title: 'HR', icon: Users,
    summary: 'Employee lifecycle: onboarding, attendance, leave, and payroll.',
    pages: [
      { label: 'Employees', desc: 'Staff records — department, designation, contract type, salary.' },
      { label: 'Attendance', desc: 'Attendance Dashboard — mark daily attendance for everyone, see KPIs and a monthly trend, and click any employee\'s card to view their full attendance history.' },
      { label: 'Leave', desc: 'Leave requests and approvals; pending leave counts feed the main dashboard\'s workflow alerts.' },
      { label: 'Payroll', desc: 'Monthly payroll runs per employee, posting salary journal entries on approval.' },
    ],
  },
  {
    id: 'finance', title: 'Finance / Accounts', icon: Landmark,
    summary: 'Chart of accounts, journal entries, and financial reporting. Most journal entries are posted automatically by other modules (e.g. a vendor payment posts its own Dr AP / Cr Cash entry) — the Journal page is where you review or make manual entries.',
    pages: [
      { label: 'Chart of Accounts', desc: 'The account hierarchy used across every module\'s postings.' },
      { label: 'Journal', desc: 'Manual and system-generated double-entry postings — every entry must balance.' },
      { label: 'Reports', desc: 'AR ageing, cash position, and other standard financial reports.' },
    ],
  },
  {
    id: 'crm', title: 'CRM', icon: UserCheck,
    summary: 'Leads and opportunities before they become a paying customer.',
    workflow: ['Lead', 'Opportunity', 'Won → linked to Customer', 'Handed to Sales for Quotation'],
    pages: [
      { label: 'Leads', desc: 'Inbound interest, qualified or disqualified.' },
      { label: 'Opportunities / Pipeline', desc: 'Qualified leads tracked through negotiation stages to close.' },
    ],
  },
  {
    id: 'retail', title: 'Retail / POS', icon: Monitor,
    summary: 'A separate point-of-sale system for retail stores, with its own batch-level stock model (independent from the main warehouse inventory above).',
    pages: [
      { label: 'POS', desc: 'Till screen for in-store sales — deducts from the matching product batch on sale.' },
      { label: 'Batches', desc: 'Batch/expiry tracking for retail stock; supports manual adjustments.' },
    ],
  },
  {
    id: 'settings', title: 'Settings', icon: Settings,
    summary: 'System control center, organized by category in the left-hand list — search box at the top jumps straight to a category.',
    pages: [
      { label: 'General', desc: 'Theme, language, date format, timezone, default currency, UI preferences.' },
      { label: 'Company / Users / Roles', desc: 'Company profile, user accounts, and the role-permission matrix.' },
      { label: 'Workflow', desc: 'Configure approval chains (who approves what, and escalation timing).' },
      { label: 'Notifications / Integrations / Security', desc: 'Notification templates, external connections (email, SMS, payment gateway), and password/session policy.' },
    ],
  },
  {
    id: 'audit', title: 'Audit Trail', icon: Shield,
    summary: 'Read-only log of who changed what, when — for compliance and troubleshooting.',
    pages: [],
  },
]

export default function HelpPage() {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = !q ? SECTIONS : SECTIONS.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.summary.toLowerCase().includes(q) ||
    s.pages.some(p => p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & User Manual"
        description="How each module of the ERP works, end to end"
        icon={HelpCircle}
        iconColor="text-blue-600"
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search the manual…" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Table of contents */}
        <div className="w-full shrink-0 lg:w-56">
          <div className="sticky top-4 space-y-1">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <s.icon className="h-3.5 w-3.5 shrink-0" />{s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-5">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</p>
          ) : filtered.map(s => (
            <Card key={s.id} id={s.id} className="scroll-mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <s.icon className="h-4.5 w-4.5 text-blue-600" />{s.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{s.summary}</p>

                {s.workflow && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 p-3">
                    {s.workflow.map((step, i) => (
                      <span key={step} className="flex items-center gap-1.5">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{step}</span>
                        {i < s.workflow!.length - 1 && <span className="text-muted-foreground/40">→</span>}
                      </span>
                    ))}
                  </div>
                )}

                {s.pages.length > 0 && (
                  <div className="space-y-2">
                    {s.pages.map(p => (
                      <div key={p.label} className={cn('rounded-lg border-l-2 border-blue-200 bg-muted/10 px-3 py-2')}>
                        <p className="text-xs font-semibold">{p.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Card className="border-border/60 bg-muted/10 shadow-sm">
            <CardContent className="flex items-start gap-3 pt-4">
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground">
                This manual covers what each module is for and how documents flow between them. For the exact fields on a specific
                form, open that page directly — most forms have inline labels and validation that explain what&apos;s required.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
