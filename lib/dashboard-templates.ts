export type WidgetType = 'kpi' | 'chart' | 'list' | 'table'

export type DashboardWidget = {
  id: string
  title: string
  type: WidgetType
  module: string
  requiredPermission: string
  visible: boolean
  order: number
}

// All possible widgets mapped to the permission that unlocks them
export const ALL_WIDGETS: Omit<DashboardWidget, 'visible' | 'order'>[] = [
  { id: 'revenue_mtd',       title: 'Revenue MTD',          type: 'kpi',   module: 'sales',       requiredPermission: 'sales:read' },
  { id: 'open_sales_orders', title: 'Open Sales Orders',    type: 'kpi',   module: 'sales',       requiredPermission: 'sales:read' },
  { id: 'top_customers',     title: 'Top Customers',        type: 'list',  module: 'crm',         requiredPermission: 'crm:read' },
  { id: 'open_pos',          title: 'Open Purchase Orders', type: 'kpi',   module: 'procurement', requiredPermission: 'procurement:read' },
  { id: 'ap_due',            title: 'AP Due This Week',     type: 'kpi',   module: 'finance',     requiredPermission: 'finance:read' },
  { id: 'ar_outstanding',    title: 'AR Outstanding',       type: 'kpi',   module: 'finance',     requiredPermission: 'finance:read' },
  { id: 'cash_position',     title: 'Cash Position',        type: 'kpi',   module: 'finance',     requiredPermission: 'finance:read' },
  { id: 'ar_aging',          title: 'AR Aging',             type: 'chart', module: 'finance',     requiredPermission: 'finance:read' },
  { id: 'monthly_revenue',   title: 'Monthly Revenue',      type: 'chart', module: 'sales',       requiredPermission: 'sales:read' },
  { id: 'expense_breakdown', title: 'Expense Breakdown',    type: 'chart', module: 'finance',     requiredPermission: 'finance:read' },
  { id: 'low_stock',         title: 'Low Stock Alerts',     type: 'kpi',   module: 'inventory',   requiredPermission: 'inventory:read' },
  { id: 'low_stock_items',   title: 'Low Stock Items',      type: 'table', module: 'inventory',   requiredPermission: 'inventory:read' },
  { id: 'pending_leaves',    title: 'Pending Leaves',       type: 'kpi',   module: 'hr',          requiredPermission: 'hr:read' },
  { id: 'pending_approvals', title: 'Pending Approvals',    type: 'kpi',   module: 'workflow',    requiredPermission: 'workflow:read' },
  { id: 'pending_workflow',  title: 'Approval Queue',       type: 'list',  module: 'workflow',    requiredPermission: 'workflow:read' },
  { id: 'notifications',     title: 'Notifications',        type: 'list',  module: 'notifications', requiredPermission: 'notifications:read' },
  { id: 'bank_accounts',     title: 'Bank Accounts',        type: 'list',  module: 'finance',     requiredPermission: 'finance:read' },
  { id: 'recent_activity',   title: 'Recent Activity',      type: 'list',  module: 'dashboard',   requiredPermission: 'dashboard:read' },
  { id: 'payroll_summary',   title: 'Payroll Summary',      type: 'kpi',   module: 'payroll',     requiredPermission: 'payroll:read' },
  { id: 'audit_log',         title: 'Audit Log',            type: 'list',  module: 'audit',       requiredPermission: 'audit:read' },
]

export function generateDashboardForPermissions(permSet: Set<string>): DashboardWidget[] {
  return ALL_WIDGETS
    .filter((w) => permSet.has(w.requiredPermission))
    .map((w, idx) => ({ ...w, visible: true, order: idx }))
}
