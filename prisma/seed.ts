import { PrismaClient, Role, ContractType, TaskStatus, ProjectStatus, AccountType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Company Settings
  await prisma.companySettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'ERP Corporation',
      legalName: 'ERP Corporation Ltd.',
      address: '123 Business Ave',
      city: 'Islamabad',
      country: 'Pakistan',
      phone: '+92-51-1234567',
      email: 'admin@gmail.com',
      currency: 'PKR',
      currencySymbol: 'Rs',
    },
  })

  // Super Admin User
  const hashedPassword = await bcrypt.hash('password', 10)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      name: 'Admin',
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: 'manager@gmail.com' },
    update: {},
    create: {
      email: 'manager@gmail.com',
      name: 'Manager',
      password: hashedPassword,
      role: Role.MANAGER,
      isActive: true,
    },
  })

  // Departments
  const deptEngineering = await prisma.department.upsert({
    where: { code: 'ENG' },
    update: {},
    create: { name: 'Engineering', code: 'ENG', description: 'Software & Systems Engineering' },
  })
  const deptHR = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: { name: 'Human Resources', code: 'HR', description: 'HR & People Operations' },
  })
  const deptFinance = await prisma.department.upsert({
    where: { code: 'FIN' },
    update: {},
    create: { name: 'Finance', code: 'FIN', description: 'Finance & Accounting' },
  })
  const deptSales = await prisma.department.upsert({
    where: { code: 'SLS' },
    update: {},
    create: { name: 'Sales', code: 'SLS', description: 'Sales & Business Development' },
  })
  await prisma.department.upsert({
    where: { code: 'OPS' },
    update: {},
    create: { name: 'Operations', code: 'OPS', description: 'Operations & Supply Chain' },
  })

  // Designations
  const desgSoftEng = await prisma.designation.upsert({
    where: { code: 'SE' },
    update: {},
    create: { name: 'Software Engineer', code: 'SE', level: 3 },
  })
  const desgSrSoftEng = await prisma.designation.upsert({
    where: { code: 'SSE' },
    update: {},
    create: { name: 'Senior Software Engineer', code: 'SSE', level: 4 },
  })
  const desgManager = await prisma.designation.upsert({
    where: { code: 'MGR' },
    update: {},
    create: { name: 'Manager', code: 'MGR', level: 5 },
  })
  const desgAnalyst = await prisma.designation.upsert({
    where: { code: 'BA' },
    update: {},
    create: { name: 'Business Analyst', code: 'BA', level: 3 },
  })
  const desgExec = await prisma.designation.upsert({
    where: { code: 'EXEC' },
    update: {},
    create: { name: 'Executive', code: 'EXEC', level: 6 },
  })

  // Employees
  const employees = [
    {
      employeeCode: 'EMP001',
      firstName: 'Alice', lastName: 'Johnson',
      email: 'alice.j@acmecorp.com', phone: '+1-555-0101',
      departmentId: deptEngineering.id, designationId: desgSrSoftEng.id,
      basicSalary: 85000, contractType: ContractType.FULL_TIME,
      joinDate: new Date('2021-03-01'),
    },
    {
      employeeCode: 'EMP002',
      firstName: 'Bob', lastName: 'Smith',
      email: 'bob.s@acmecorp.com', phone: '+1-555-0102',
      departmentId: deptEngineering.id, designationId: desgSoftEng.id,
      basicSalary: 65000, contractType: ContractType.FULL_TIME,
      joinDate: new Date('2022-06-15'),
    },
    {
      employeeCode: 'EMP003',
      firstName: 'Carol', lastName: 'White',
      email: 'carol.w@acmecorp.com', phone: '+1-555-0103',
      departmentId: deptHR.id, designationId: desgManager.id,
      basicSalary: 75000, contractType: ContractType.FULL_TIME,
      joinDate: new Date('2020-01-10'),
    },
    {
      employeeCode: 'EMP004',
      firstName: 'David', lastName: 'Brown',
      email: 'david.b@acmecorp.com', phone: '+1-555-0104',
      departmentId: deptFinance.id, designationId: desgAnalyst.id,
      basicSalary: 70000, contractType: ContractType.FULL_TIME,
      joinDate: new Date('2021-09-20'),
    },
    {
      employeeCode: 'EMP005',
      firstName: 'Eve', lastName: 'Davis',
      email: 'eve.d@acmecorp.com', phone: '+1-555-0105',
      departmentId: deptSales.id, designationId: desgExec.id,
      basicSalary: 90000, contractType: ContractType.FULL_TIME,
      joinDate: new Date('2019-05-01'),
    },
  ]

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { employeeCode: emp.employeeCode },
      update: {},
      create: {
        ...emp,
        basicSalary: emp.basicSalary,
      },
    })
  }

  // Vendors
  const vendors = [
    {
      vendorCode: 'VND001', name: 'TechSupply Co.', contactPerson: 'Mark Lee',
      email: 'mark@techsupply.com', phone: '+1-555-0200',
      address: '456 Supplier St', city: 'San Francisco', country: 'US',
      paymentTerms: 30,
    },
    {
      vendorCode: 'VND002', name: 'Office Essentials Ltd', contactPerson: 'Sarah Kim',
      email: 'sarah@officeessentials.com', phone: '+1-555-0201',
      address: '789 Commerce Blvd', city: 'Chicago', country: 'US',
      paymentTerms: 45,
    },
    {
      vendorCode: 'VND003', name: 'Global Parts Inc', contactPerson: 'Tom Wilson',
      email: 'tom@globalparts.com', phone: '+1-555-0202',
      address: '321 Industrial Ave', city: 'Houston', country: 'US',
      paymentTerms: 60,
    },
  ]

  for (const vendor of vendors) {
    await prisma.vendor.upsert({
      where: { vendorCode: vendor.vendorCode },
      update: {},
      create: vendor,
    })
  }

  // Customers
  const customers = [
    {
      customerCode: 'CUS001', name: 'Beta Solutions LLC', contactPerson: 'Jane Foster',
      email: 'jane@betasolutions.com', phone: '+1-555-0300',
      address: '100 Client Ave', city: 'Boston', country: 'US',
      paymentTerms: 30,
    },
    {
      customerCode: 'CUS002', name: 'Gamma Industries', contactPerson: 'Peter Parker',
      email: 'peter@gammaindustries.com', phone: '+1-555-0301',
      address: '200 Enterprise Dr', city: 'Seattle', country: 'US',
      paymentTerms: 45,
    },
    {
      customerCode: 'CUS003', name: 'Delta Corp', contactPerson: 'Mary Jane',
      email: 'mary@deltacorp.com', phone: '+1-555-0302',
      address: '300 Business Park', city: 'Austin', country: 'US',
      paymentTerms: 15,
    },
  ]

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { customerCode: customer.customerCode },
      update: {},
      create: customer,
    })
  }

  // Item Categories
  const catElectronics = await prisma.itemCategory.upsert({
    where: { code: 'ELEC' },
    update: {},
    create: { name: 'Electronics', code: 'ELEC', description: 'Electronic components and devices' },
  })
  const catOffice = await prisma.itemCategory.upsert({
    where: { code: 'OFFC' },
    update: {},
    create: { name: 'Office Supplies', code: 'OFFC', description: 'Office stationery and supplies' },
  })
  const catParts = await prisma.itemCategory.upsert({
    where: { code: 'PRTS' },
    update: {},
    create: { name: 'Spare Parts', code: 'PRTS', description: 'Mechanical and electrical parts' },
  })

  // Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH001' },
    update: {},
    create: { code: 'WH001', name: 'Main Warehouse', address: '123 Warehouse Rd', isActive: true },
  })

  // Items
  const items = [
    { sku: 'ITEM001', name: 'Laptop 15"', categoryId: catElectronics.id, uom: 'PCS', standardCost: 800, sellingPrice: 1200, reorderPoint: 5, reorderQty: 10 },
    { sku: 'ITEM002', name: 'Wireless Mouse', categoryId: catElectronics.id, uom: 'PCS', standardCost: 20, sellingPrice: 35, reorderPoint: 20, reorderQty: 50 },
    { sku: 'ITEM003', name: 'USB-C Hub', categoryId: catElectronics.id, uom: 'PCS', standardCost: 30, sellingPrice: 55, reorderPoint: 15, reorderQty: 30 },
    { sku: 'ITEM004', name: 'A4 Paper (Ream)', categoryId: catOffice.id, uom: 'REAM', standardCost: 5, sellingPrice: 8, reorderPoint: 50, reorderQty: 100 },
    { sku: 'ITEM005', name: 'Ballpoint Pens (Box)', categoryId: catOffice.id, uom: 'BOX', standardCost: 3, sellingPrice: 6, reorderPoint: 30, reorderQty: 60 },
    { sku: 'ITEM006', name: 'Whiteboard Marker Set', categoryId: catOffice.id, uom: 'SET', standardCost: 8, sellingPrice: 15, reorderPoint: 10, reorderQty: 20 },
    { sku: 'ITEM007', name: 'HDMI Cable 2m', categoryId: catElectronics.id, uom: 'PCS', standardCost: 10, sellingPrice: 18, reorderPoint: 25, reorderQty: 50 },
    { sku: 'ITEM008', name: 'Bearing 6205', categoryId: catParts.id, uom: 'PCS', standardCost: 12, sellingPrice: 20, reorderPoint: 30, reorderQty: 100 },
    { sku: 'ITEM009', name: 'V-Belt A50', categoryId: catParts.id, uom: 'PCS', standardCost: 8, sellingPrice: 14, reorderPoint: 20, reorderQty: 50 },
    { sku: 'ITEM010', name: '24" Monitor', categoryId: catElectronics.id, uom: 'PCS', standardCost: 250, sellingPrice: 380, reorderPoint: 3, reorderQty: 10 },
  ]

  for (const item of items) {
    const created = await prisma.item.upsert({
      where: { sku: item.sku },
      update: {},
      create: item,
    })

    // Seed initial stock
    await prisma.warehouseStock.upsert({
      where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: created.id } },
      update: {},
      create: {
        warehouseId: warehouse.id,
        itemId: created.id,
        quantity: Math.floor(Math.random() * 50) + 10,
        avgCost: item.standardCost,
      },
    })
  }

  // Chart of Accounts
  const accounts = [
    { code: '1000', name: 'Assets', type: AccountType.ASSET, isSystem: true },
    { code: '1100', name: 'Current Assets', type: AccountType.ASSET, isSystem: true },
    { code: '1110', name: 'Cash and Cash Equivalents', type: AccountType.ASSET, isSystem: true },
    { code: '1120', name: 'Accounts Receivable', type: AccountType.ASSET, isSystem: true },
    { code: '1130', name: 'Inventory', type: AccountType.ASSET, isSystem: true },
    { code: '1200', name: 'Fixed Assets', type: AccountType.ASSET, isSystem: true },
    { code: '2000', name: 'Liabilities', type: AccountType.LIABILITY, isSystem: true },
    { code: '2100', name: 'Current Liabilities', type: AccountType.LIABILITY, isSystem: true },
    { code: '2110', name: 'Accounts Payable', type: AccountType.LIABILITY, isSystem: true },
    { code: '2120', name: 'Accrued Expenses', type: AccountType.LIABILITY, isSystem: true },
    { code: '3000', name: 'Equity', type: AccountType.EQUITY, isSystem: true },
    { code: '3100', name: 'Retained Earnings', type: AccountType.EQUITY, isSystem: true },
    { code: '4000', name: 'Revenue', type: AccountType.REVENUE, isSystem: true },
    { code: '4100', name: 'Sales Revenue', type: AccountType.REVENUE, isSystem: true },
    { code: '4200', name: 'Service Revenue', type: AccountType.REVENUE, isSystem: true },
    { code: '5000', name: 'Expenses', type: AccountType.EXPENSE, isSystem: true },
    { code: '5100', name: 'Cost of Goods Sold', type: AccountType.EXPENSE, isSystem: true },
    { code: '5200', name: 'Salaries & Wages', type: AccountType.EXPENSE, isSystem: true },
    { code: '5300', name: 'Rent & Utilities', type: AccountType.EXPENSE, isSystem: true },
    { code: '5400', name: 'Marketing & Advertising', type: AccountType.EXPENSE, isSystem: true },
    { code: '5500', name: 'Depreciation', type: AccountType.EXPENSE, isSystem: true },
  ]

  const accountMap: Record<string, string> = {}
  for (const acc of accounts) {
    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: acc,
    })
    accountMap[acc.code] = created.id
  }

  // Set parent-child relationships for COA
  const parentMap: Record<string, string> = {
    '1100': '1000', '1200': '1000',
    '1110': '1100', '1120': '1100', '1130': '1100',
    '2100': '2000', '2110': '2100', '2120': '2100',
    '3100': '3000',
    '4100': '4000', '4200': '4000',
    '5100': '5000', '5200': '5000', '5300': '5000', '5400': '5000', '5500': '5000',
  }
  for (const [childCode, parentCode] of Object.entries(parentMap)) {
    await prisma.account.update({
      where: { code: childCode },
      data: { parentId: accountMap[parentCode] },
    })
  }

  // Sample Project with WBS
  const project = await prisma.project.upsert({
    where: { code: 'PRJ001' },
    update: {},
    create: {
      code: 'PRJ001',
      name: 'ERP Implementation',
      description: 'Enterprise-wide ERP system rollout',
      status: ProjectStatus.ACTIVE,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      budget: 500000,
      actualCost: 125000,
      progress: 25,
    },
  })

  const wbs1 = await prisma.wBSItem.upsert({
    where: { projectId_code: { projectId: project.id, code: '1.0' } },
    update: {},
    create: {
      projectId: project.id, code: '1.0', name: 'Project Initiation', level: 1,
      startDate: new Date('2026-01-01'), endDate: new Date('2026-02-28'),
      budget: 50000, actualCost: 45000, progress: 100,
    },
  })
  const wbs2 = await prisma.wBSItem.upsert({
    where: { projectId_code: { projectId: project.id, code: '2.0' } },
    update: {},
    create: {
      projectId: project.id, code: '2.0', name: 'System Configuration', level: 1,
      startDate: new Date('2026-03-01'), endDate: new Date('2026-06-30'),
      budget: 200000, actualCost: 80000, progress: 40,
    },
  })
  const wbs3 = await prisma.wBSItem.upsert({
    where: { projectId_code: { projectId: project.id, code: '3.0' } },
    update: {},
    create: {
      projectId: project.id, code: '3.0', name: 'Training & Go-Live', level: 1,
      startDate: new Date('2026-07-01'), endDate: new Date('2026-12-31'),
      budget: 250000, actualCost: 0, progress: 0,
    },
  })

  await prisma.wBSItem.upsert({
    where: { projectId_code: { projectId: project.id, code: '1.1' } },
    update: {},
    create: {
      projectId: project.id, parentId: wbs1.id, code: '1.1', name: 'Requirements Gathering', level: 2,
      startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'),
      budget: 20000, actualCost: 18000, progress: 100,
    },
  })
  await prisma.wBSItem.upsert({
    where: { projectId_code: { projectId: project.id, code: '1.2' } },
    update: {},
    create: {
      projectId: project.id, parentId: wbs1.id, code: '1.2', name: 'Project Planning', level: 2,
      startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28'),
      budget: 30000, actualCost: 27000, progress: 100,
    },
  })
  await prisma.wBSItem.upsert({
    where: { projectId_code: { projectId: project.id, code: '2.1' } },
    update: {},
    create: {
      projectId: project.id, parentId: wbs2.id, code: '2.1', name: 'HR Module Setup', level: 2,
      startDate: new Date('2026-03-01'), endDate: new Date('2026-04-30'),
      budget: 80000, actualCost: 50000, progress: 60,
    },
  })
  await prisma.wBSItem.upsert({
    where: { projectId_code: { projectId: project.id, code: '2.2' } },
    update: {},
    create: {
      projectId: project.id, parentId: wbs2.id, code: '2.2', name: 'Finance Module Setup', level: 2,
      startDate: new Date('2026-05-01'), endDate: new Date('2026-06-30'),
      budget: 120000, actualCost: 30000, progress: 25,
    },
  })

  // Milestone
  const milestone = await prisma.milestone.upsert({
    where: { id: 'milestone-01' },
    update: {},
    create: {
      id: 'milestone-01',
      projectId: project.id,
      name: 'Phase 1 Complete',
      description: 'All initial setup and configuration done',
      dueDate: new Date('2026-06-30'),
      progress: 50,
    },
  })

  // Tasks
  const tasks = [
    { title: 'Install ERP software', status: TaskStatus.DONE, priority: 'HIGH', wbsItemId: wbs1.id, milestoneId: milestone.id, dueDate: new Date('2026-01-15') },
    { title: 'Configure HR module', status: TaskStatus.IN_PROGRESS, priority: 'HIGH', wbsItemId: wbs2.id, milestoneId: milestone.id, dueDate: new Date('2026-04-30') },
    { title: 'Data migration planning', status: TaskStatus.TODO, priority: 'MEDIUM', wbsItemId: wbs2.id, milestoneId: milestone.id, dueDate: new Date('2026-05-15') },
    { title: 'User acceptance testing', status: TaskStatus.TODO, priority: 'HIGH', wbsItemId: wbs3.id, milestoneId: milestone.id, dueDate: new Date('2026-08-31') },
    { title: 'Staff training sessions', status: TaskStatus.TODO, priority: 'MEDIUM', wbsItemId: wbs3.id, milestoneId: milestone.id, dueDate: new Date('2026-09-30') },
  ]

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const taskId = `task-0${i + 1}`
    await prisma.projectTask.upsert({
      where: { id: taskId },
      update: {},
      create: {
        id: taskId,
        projectId: project.id,
        assigneeId: superAdmin.id,
        estimatedHours: 40,
        ...t,
      },
    })
  }

  // ── UK RETAIL SEED DATA ─────────────────────────────────────────────────────

  console.log('Seeding UK retail data...')

  // StoreSettings
  await prisma.storeSettings.upsert({
    where: { id: 'store' },
    update: {},
    create: {
      id: 'store',
      storeName: 'Acme Retail UK',
      storeAddress: '10 High Street, Manchester, M1 1AA',
      vatRegistrationNumber: 'GB123456789',
      vatQuarterMonth1: 1, vatQuarterMonth2: 4, vatQuarterMonth3: 7, vatQuarterMonth4: 10,
      defaultVatGroceries: 0.00, defaultVatToiletries: 0.20,
      defaultVatClothing: 0.20, defaultVatElectronics: 0.20,
      loyaltyPointsPerPound: 1, loyaltyRedemptionRate: 100,
      wageCostTargetPct: 25.00,
      alertFefo7Day: true, alertLowStock: true, alertVisaExpiry: true, alertWtdBreach: true,
    },
  })

  // Update employees with UK HR fields (first 2 get visa expiry within 45 days)
  const today = new Date('2026-06-27')
  const ukEmployeeData = [
    { employeeCode: 'EMP001', niNumber: 'AB123456C', payrollId: 'PAY001', hourlyRateGbp: 12.50, rightToWorkProofSeen: true, rightToWorkDocType: 'Passport', visaExpiryDate: new Date('2026-07-15'), pensionEnrolled: true },
    { employeeCode: 'EMP002', niNumber: 'CD789012E', payrollId: 'PAY002', hourlyRateGbp: 11.44, rightToWorkProofSeen: true, rightToWorkDocType: 'BRP', visaExpiryDate: new Date('2026-08-05'), pensionEnrolled: false },
    { employeeCode: 'EMP003', niNumber: 'EF345678G', payrollId: 'PAY003', hourlyRateGbp: 14.00, rightToWorkProofSeen: true, rightToWorkDocType: 'UK Passport', visaExpiryDate: null, pensionEnrolled: true },
    { employeeCode: 'EMP004', niNumber: 'GH901234I', payrollId: 'PAY004', hourlyRateGbp: 13.50, rightToWorkProofSeen: true, rightToWorkDocType: 'UK Passport', visaExpiryDate: null, pensionEnrolled: true },
    { employeeCode: 'EMP005', niNumber: 'IJ567890K', payrollId: 'PAY005', hourlyRateGbp: 16.00, rightToWorkProofSeen: true, rightToWorkDocType: 'UK Passport', visaExpiryDate: null, pensionEnrolled: true },
  ]
  for (const { employeeCode, ...data } of ukEmployeeData) {
    await prisma.employee.updateMany({ where: { employeeCode }, data })
  }

  // 3 UK Suppliers
  let suppliers: { id: number }[] = await prisma.supplier.findMany({ select: { id: true } })
  if (suppliers.length === 0) {
    await prisma.supplier.createMany({
      data: [
        { companyName: 'Fresh Produce UK Ltd', contactPerson: 'James Parker', email: 'james@freshproduce.co.uk', phone: '0161 234 5678', paymentTerms: 'Net 30', bankSortCode: '20-00-00', bankAccountNumber: '12345678', leadTimeDays: 2, performanceRating: 5 },
        { companyName: 'Household Goods Direct', contactPerson: 'Sarah Ahmed', email: 'sarah@hgdirect.co.uk', phone: '0161 876 5432', paymentTerms: 'Net 14', bankSortCode: '30-00-00', bankAccountNumber: '87654321', leadTimeDays: 5, performanceRating: 4 },
        { companyName: 'Tech Distributors PLC', contactPerson: 'Mike Patel', email: 'mike@techdist.co.uk', phone: '0161 999 1234', paymentTerms: 'Net 60', bankSortCode: '40-00-00', bankAccountNumber: '11223344', leadTimeDays: 7, performanceRating: 3 },
      ],
    })
    suppliers = await prisma.supplier.findMany({ select: { id: true } })
  }
  const [sup1, sup2, sup3] = suppliers

  // 20 Products across 4 categories
  const productData = [
    // Groceries — zero VAT
    { sku: 'GRC-001', productName: 'Whole Milk 2L', category: 'Groceries', sellingPriceGbp: 1.45, vatRate: 0.00, reorderLevel: 50 },
    { sku: 'GRC-002', productName: 'White Bread 800g', category: 'Groceries', sellingPriceGbp: 1.20, vatRate: 0.00, reorderLevel: 40 },
    { sku: 'GRC-003', productName: 'Free Range Eggs x12', category: 'Groceries', sellingPriceGbp: 3.50, vatRate: 0.00, reorderLevel: 30 },
    { sku: 'GRC-004', productName: 'Cheddar Cheese 400g', category: 'Groceries', sellingPriceGbp: 3.80, vatRate: 0.00, reorderLevel: 20 },
    { sku: 'GRC-005', productName: 'Organic Bananas 1kg', category: 'Groceries', sellingPriceGbp: 1.30, vatRate: 0.00, reorderLevel: 35 },
    // Toiletries — 20% VAT
    { sku: 'TOI-001', productName: 'Shampoo 400ml', category: 'Toiletries', sellingPriceGbp: 4.50, vatRate: 0.20, reorderLevel: 25 },
    { sku: 'TOI-002', productName: 'Body Wash 500ml', category: 'Toiletries', sellingPriceGbp: 3.99, vatRate: 0.20, reorderLevel: 20 },
    { sku: 'TOI-003', productName: 'Toothpaste 100ml', category: 'Toiletries', sellingPriceGbp: 2.79, vatRate: 0.20, reorderLevel: 30 },
    { sku: 'TOI-004', productName: 'Deodorant Roll-On 50ml', category: 'Toiletries', sellingPriceGbp: 2.50, vatRate: 0.20, reorderLevel: 25 },
    { sku: 'TOI-005', productName: 'Hand Cream 75ml', category: 'Toiletries', sellingPriceGbp: 3.20, vatRate: 0.20, reorderLevel: 15 },
    // Clothing — 20% VAT
    { sku: 'CLO-001', productName: "Men's T-Shirt (M)", category: 'Clothing', sellingPriceGbp: 9.99, vatRate: 0.20, reorderLevel: 10 },
    { sku: 'CLO-002', productName: "Women's Scarf", category: 'Clothing', sellingPriceGbp: 14.99, vatRate: 0.20, reorderLevel: 8 },
    { sku: 'CLO-003', productName: 'Woolly Hat', category: 'Clothing', sellingPriceGbp: 7.99, vatRate: 0.20, reorderLevel: 12 },
    { sku: 'CLO-004', productName: "Kids' Socks 3-Pack", category: 'Clothing', sellingPriceGbp: 4.50, vatRate: 0.20, reorderLevel: 20 },
    { sku: 'CLO-005', productName: 'Rain Jacket (L)', category: 'Clothing', sellingPriceGbp: 29.99, vatRate: 0.20, reorderLevel: 5 },
    // Electronics — 20% VAT
    { sku: 'ELC-001', productName: 'USB-C Charger 20W', category: 'Electronics', sellingPriceGbp: 12.99, vatRate: 0.20, reorderLevel: 15 },
    { sku: 'ELC-002', productName: 'Bluetooth Earbuds', category: 'Electronics', sellingPriceGbp: 24.99, vatRate: 0.20, reorderLevel: 10 },
    { sku: 'ELC-003', productName: 'Phone Case Universal', category: 'Electronics', sellingPriceGbp: 7.99, vatRate: 0.20, reorderLevel: 20 },
    { sku: 'ELC-004', productName: 'Power Bank 10000mAh', category: 'Electronics', sellingPriceGbp: 19.99, vatRate: 0.20, reorderLevel: 8 },
    { sku: 'ELC-005', productName: 'LED Desk Lamp', category: 'Electronics', sellingPriceGbp: 17.99, vatRate: 0.20, reorderLevel: 6 },
  ]

  const productMap: Record<string, number> = {}
  for (const p of productData) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    })
    productMap[p.sku] = prod.id
  }

  // 3 InventoryBatches per product (only seed if none exist)
  const batchCount = await prisma.inventoryBatch.count()
  if (batchCount === 0) {
    // Expiry dates: some critical (≤7d), some amber (≤14d), some green (>30d)
    const batches: { productId: number; supplierId: number; batchNumber: string; quantityOnHand: number; receivedDate: Date; expiryDate: Date | null }[] = []

    for (const p of productData) {
      const pid = productMap[p.sku]
      const isGrocery = p.category === 'Groceries'
      const isToiletry = p.category === 'Toiletries'
      const supplierId = isGrocery ? sup1.id : isToiletry ? sup2.id : sup3.id

      batches.push(
        {
          productId: pid, supplierId,
          batchNumber: `${p.sku}-B1`,
          quantityOnHand: isGrocery ? 5 : 20,
          receivedDate: new Date('2026-06-20'),
          expiryDate: isGrocery ? new Date('2026-07-03') : isToiletry ? new Date('2026-07-08') : null,
        },
        {
          productId: pid, supplierId,
          batchNumber: `${p.sku}-B2`,
          quantityOnHand: 30,
          receivedDate: new Date('2026-06-15'),
          expiryDate: isGrocery ? new Date('2026-07-11') : isToiletry ? new Date('2026-07-25') : null,
        },
        {
          productId: pid, supplierId,
          batchNumber: `${p.sku}-B3`,
          quantityOnHand: 50,
          receivedDate: new Date('2026-06-01'),
          expiryDate: isGrocery ? new Date('2026-08-26') : isToiletry ? new Date('2026-09-30') : null,
        },
      )
    }

    await prisma.inventoryBatch.createMany({ data: batches })
  }

  // Get batch IDs for sales orders
  const allBatches = await prisma.inventoryBatch.findMany({ select: { id: true, productId: true } })
  function getBatchId(sku: string, batchIdx = 0) {
    const pid = productMap[sku]
    return allBatches.filter((b) => b.productId === pid)[batchIdx]?.id ?? allBatches[0].id
  }

  // 5 RetailCustomers with GDPR data
  const customerEmails = [
    'emily.clarke@email.co.uk',
    'james.wilson@email.co.uk',
    'priya.patel@email.co.uk',
    'david.okafor@email.co.uk',
    'sarah.brooks@email.co.uk',
  ]
  const retailCustomers: { id: number }[] = []
  const customerData = [
    { firstName: 'Emily', lastName: 'Clarke', email: customerEmails[0], phone: '07700900001', dateOfBirth: new Date('1990-04-15'), loyaltyPointsBalance: 250, marketingOptIn: true, gdprConsentDate: new Date('2025-01-10'), dataRetentionConsent: true },
    { firstName: 'James', lastName: 'Wilson', email: customerEmails[1], phone: '07700900002', dateOfBirth: new Date('1985-09-22'), loyaltyPointsBalance: 110, marketingOptIn: false, gdprConsentDate: new Date('2025-03-05'), dataRetentionConsent: true },
    { firstName: 'Priya', lastName: 'Patel', email: customerEmails[2], phone: '07700900003', dateOfBirth: new Date('1995-12-01'), loyaltyPointsBalance: 480, marketingOptIn: true, gdprConsentDate: new Date('2025-02-14'), dataRetentionConsent: true },
    { firstName: 'David', lastName: 'Okafor', email: customerEmails[3], phone: '07700900004', dateOfBirth: new Date('1978-06-30'), loyaltyPointsBalance: 75, marketingOptIn: true, gdprConsentDate: new Date('2025-04-20'), dataRetentionConsent: false },
    { firstName: 'Sarah', lastName: 'Brooks', email: customerEmails[4], phone: '07700900005', dateOfBirth: new Date('2000-11-17'), loyaltyPointsBalance: 320, marketingOptIn: false, gdprConsentDate: new Date('2025-05-01'), dataRetentionConsent: true },
  ]
  for (const c of customerData) {
    const rc = await prisma.retailCustomer.upsert({
      where: { email: c.email },
      update: {},
      create: c,
    })
    retailCustomers.push({ id: rc.id })
  }

  // 10 RetailSalesOrders (only if none exist)
  const soCount = await prisma.retailSalesOrder.count()
  if (soCount === 0) {
    const skus = ['GRC-001', 'GRC-002', 'TOI-001', 'CLO-001', 'ELC-001']
    const paymentMethods = ['Cash', 'Card', 'Card', 'Contactless', 'Card', 'Cash', 'Contactless', 'Card', 'Card', 'Cash']
    for (let i = 0; i < 10; i++) {
      const sku = skus[i % skus.length]
      const product = productData.find((p) => p.sku === sku)!
      const batchId = getBatchId(sku, 0)
      const qty = (i % 3) + 1
      const unitPrice = Number(product.sellingPriceGbp)
      const vatRate = Number(product.vatRate)
      const netTotal = unitPrice * qty
      const vatAmount = netTotal * vatRate
      const grandTotal = netTotal + vatAmount
      const daysAgo = i * 3
      const txDate = new Date(today)
      txDate.setDate(txDate.getDate() - daysAgo)

      const order = await prisma.retailSalesOrder.create({
        data: {
          transactionDate: txDate,
          customerId: i < 5 ? retailCustomers[i].id : null,
          paymentMethod: paymentMethods[i],
          netTotalGbp: netTotal,
          vatAmountGbp: vatAmount,
          grandTotalGbp: grandTotal,
        },
      })
      await prisma.retailSalesLineItem.create({
        data: {
          orderId: order.id,
          productId: productMap[sku],
          batchId,
          quantity: qty,
          unitPriceGbp: unitPrice,
          vatRateApplied: vatRate,
        },
      })
    }
  }

  // 3 RetailPurchaseOrders (only if none exist)
  const poCount = await prisma.retailPurchaseOrder.count()
  if (poCount === 0) {
    const po1 = await prisma.retailPurchaseOrder.create({
      data: {
        supplierId: sup1.id,
        status: 'Draft',
        orderDate: new Date('2026-06-25'),
        expectedDeliveryDate: new Date('2026-07-02'),
        totalCostGbp: 120.00,
      },
    })
    await prisma.retailPoLineItem.createMany({
      data: [
        { poId: po1.id, productId: productMap['GRC-001'], quantityOrdered: 100, unitCostGbp: 0.80 },
        { poId: po1.id, productId: productMap['GRC-002'], quantityOrdered: 80, unitCostGbp: 0.65 },
      ],
    })

    const po2 = await prisma.retailPurchaseOrder.create({
      data: {
        supplierId: sup2.id,
        status: 'Sent',
        orderDate: new Date('2026-06-20'),
        expectedDeliveryDate: new Date('2026-07-05'),
        totalCostGbp: 250.00,
      },
    })
    await prisma.retailPoLineItem.createMany({
      data: [
        { poId: po2.id, productId: productMap['TOI-001'], quantityOrdered: 50, unitCostGbp: 2.50 },
        { poId: po2.id, productId: productMap['TOI-002'], quantityOrdered: 50, unitCostGbp: 2.20 },
      ],
    })

    const po3 = await prisma.retailPurchaseOrder.create({
      data: {
        supplierId: sup3.id,
        status: 'Received',
        orderDate: new Date('2026-06-01'),
        expectedDeliveryDate: new Date('2026-06-15'),
        totalCostGbp: 600.00,
      },
    })
    await prisma.retailPoLineItem.createMany({
      data: [
        { poId: po3.id, productId: productMap['ELC-001'], quantityOrdered: 30, unitCostGbp: 8.00, quantityReceived: 30 },
        { poId: po3.id, productId: productMap['ELC-002'], quantityOrdered: 20, unitCostGbp: 15.00, quantityReceived: 20 },
      ],
    })
    await prisma.goodsReceivedNote.create({
      data: { poId: po3.id, receivedDate: new Date('2026-06-16'), receivedBy: 'Alice Johnson' },
    })
  }

  // ExpenseCategories + 5 Expenses
  const expCatRent = await prisma.expenseCategory.upsert({ where: { categoryName: 'Rent & Rates' }, update: {}, create: { categoryName: 'Rent & Rates' } })
  const expCatUtil = await prisma.expenseCategory.upsert({ where: { categoryName: 'Utilities' }, update: {}, create: { categoryName: 'Utilities' } })
  const expCatWage = await prisma.expenseCategory.upsert({ where: { categoryName: 'Wages & Salaries' }, update: {}, create: { categoryName: 'Wages & Salaries' } })
  const expCatMaint = await prisma.expenseCategory.upsert({ where: { categoryName: 'Maintenance' }, update: {}, create: { categoryName: 'Maintenance' } })
  const expCatMarket = await prisma.expenseCategory.upsert({ where: { categoryName: 'Marketing' }, update: {}, create: { categoryName: 'Marketing' } })

  const expCount = await prisma.expense.count()
  if (expCount === 0) {
    await prisma.expense.createMany({
      data: [
        { expenseDate: new Date('2026-06-01'), categoryId: expCatRent.id, supplierId: null, description: 'Monthly shop rent — June 2026', amountGbp: 3500.00, vatClaimedGbp: 0, paymentDueDate: new Date('2026-06-15'), status: 'Paid' },
        { expenseDate: new Date('2026-06-05'), categoryId: expCatUtil.id, supplierId: null, description: 'Electricity & Gas — May 2026', amountGbp: 420.00, vatClaimedGbp: 70.00, paymentDueDate: new Date('2026-06-20'), status: 'Paid' },
        { expenseDate: new Date('2026-06-10'), categoryId: expCatWage.id, supplierId: null, description: 'Staff wages week ending 2026-06-07', amountGbp: 2800.00, vatClaimedGbp: 0, paymentDueDate: null, status: 'Paid' },
        { expenseDate: new Date('2026-06-18'), categoryId: expCatMaint.id, supplierId: sup3.id, description: 'EPOS system service contract', amountGbp: 350.00, vatClaimedGbp: 58.33, paymentDueDate: new Date('2026-07-18'), status: 'Unpaid' },
        { expenseDate: new Date('2026-06-22'), categoryId: expCatMarket.id, supplierId: null, description: 'Social media advertising — June', amountGbp: 200.00, vatClaimedGbp: 33.33, paymentDueDate: new Date('2026-07-05'), status: 'Unpaid' },
      ],
    })
  }

  // ShiftRoster — 5 employees × 7 days (only if none exist)
  const shiftCount = await prisma.shiftRoster.count()
  if (shiftCount === 0) {
    const empRows = await prisma.employee.findMany({
      where: { employeeCode: { in: ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005'] } },
      select: { id: true, employeeCode: true },
    })
    const shiftData: { employeeId: string; shiftDate: Date; startTime: string; endTime: string }[] = []
    for (let d = 0; d < 7; d++) {
      const shiftDate = new Date(today)
      shiftDate.setDate(shiftDate.getDate() + d)
      for (const emp of empRows) {
        const isMorning = empRows.indexOf(emp) < 3
        shiftData.push({
          employeeId: emp.id,
          shiftDate,
          startTime: isMorning ? '07:00' : '14:00',
          endTime: isMorning ? '15:00' : '22:00',
        })
      }
    }
    await prisma.shiftRoster.createMany({ data: shiftData })
  }

  console.log('Database seeded successfully!')
  // Login credentials printed only in dev — DO NOT log in production
  if (process.env.NODE_ENV !== 'production') console.log('Login: admin@acmecorp.com / Admin@123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
