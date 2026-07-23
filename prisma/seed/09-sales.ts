import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { randInt, randFloat, generateSONumber, generateInvoiceNumber } from './utils'

export async function seedSales(
  prisma: PrismaClient,
  customerIdsByIndex: string[],
  itemIds: string[],
  companyId: string,
): Promise<{ soIds: string[]; invoiceIds: string[] }> {
  console.log('\n--- Seeding Sales Orders, Invoices & Payments ---')

  const soIds: string[] = []
  const invoiceIds: string[] = []

  const soDateStart = new Date('2025-09-01')
  const soDateEnd = new Date('2026-07-15')

  let soCounter = 1
  let invCounter = 1

  const usedCustomers = customerIdsByIndex.slice(0, 50)

  for (let ci = 0; ci < usedCustomers.length; ci++) {
    const customerId = usedCustomers[ci]
    const numSOs = ci % 15 === 0 ? 3 : randInt(1, 2)

    for (let s = 0; s < numSOs; s++) {
      const numLines = randInt(1, 4)
      let totalAmount = 0
      const lineItems: { itemId: string; qty: number; unitPrice: number; totalPrice: number }[] = []

      for (let l = 0; l < numLines; l++) {
        const itemIdx = randInt(0, itemIds.length - 1)
        const itemId = itemIds[itemIdx]
        const qty = randInt(1, 30)
        const unitPrice = randFloat(200, 50000, 0)
        const totalPrice = qty * unitPrice
        totalAmount += totalPrice
        lineItems.push({ itemId, qty, unitPrice, totalPrice })
      }

      const soDate = faker.date.between({ from: soDateStart, to: soDateEnd })
      const soNum = generateSONumber(soCounter++)

      const so = await prisma.salesOrder.create({
        data: {
          soNumber: soNum,
          customerId,
          companyId,
          orderDate: soDate,
          status: 'DELIVERED',
          subTotal: totalAmount,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount,
          notes: 'Standard sales order',
        },
      })
      soIds.push(so.id)

      const createdItems: { id: string; itemId: string; qty: number; unitPrice: number }[] = []

      for (const li of lineItems) {
        const soi = await prisma.salesOrderItem.create({
          data: {
            soId: so.id,
            itemId: li.itemId,
            description: `Sales item`,
            quantity: li.qty,
            deliveredQty: li.qty,
            unitPrice: li.unitPrice,
            totalPrice: li.totalPrice,
          },
        })
        createdItems.push({ id: soi.id, itemId: li.itemId!, qty: li.qty, unitPrice: li.unitPrice })
      }

      const invoiceDate = faker.date.between({ from: soDate, to: new Date('2026-07-20') })
      const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      const invNum = generateInvoiceNumber(invCounter++)

      const invoice = await prisma.customerInvoice.create({
        data: {
          invoiceNumber: invNum,
          customerId,
          companyId,
          soId: so.id,
          invoiceDate,
          dueDate,
          subTotal: totalAmount,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount,
          paidAmount: totalAmount,
          status: 'PAID',
        },
      })
      invoiceIds.push(invoice.id)

      for (const li of lineItems) {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            itemId: li.itemId,
            description: `Sales item`,
            quantity: li.qty,
            unitPrice: li.unitPrice,
            totalPrice: li.totalPrice,
          },
        })
      }

      const paymentDate = faker.date.between({ from: invoiceDate, to: dueDate })
      await prisma.customerPayment.create({
        data: {
          invoiceId: invoice.id,
          amount: totalAmount,
          paymentDate,
          method: faker.helpers.arrayElement(['Cash', 'Bank Transfer', 'Cheque', 'JazzCash', 'Easypaisa']),
          reference: `PAY-${invNum}`,
        },
      })
    }

    if ((ci + 1) % 20 === 0) process.stdout.write(` Customers processed: ${ci + 1}/${usedCustomers.length}\n`)
  }

  console.log(` Sales Orders: ${soIds.length}`)
  console.log(` Invoices: ${invoiceIds.length}`)

  return { soIds, invoiceIds }
}
