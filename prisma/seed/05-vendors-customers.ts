import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { generateVendorCode, generateCustomerCode } from './utils'
import { VENDOR_NAMES, CUSTOMER_NAMES, PAKISTAN_CITIES } from './constants'

export async function seedVendors(
  prisma: PrismaClient,
): Promise<{ vendorIds: string[]; vendorIdsByIndex: string[] }> {
  console.log('\n--- Seeding Vendors & Supplier Contacts ---')

  const vendorIds: string[] = []
  const vendorIdsByIndex: string[] = []

  for (let i = 0; i < VENDOR_NAMES.length; i++) {
    const code = generateVendorCode(i + 1)
    const city = faker.helpers.arrayElement(PAKISTAN_CITIES)

    const vendor = await prisma.vendor.create({
      data: {
        vendorCode: code,
        name: VENDOR_NAMES[i],
        contactPerson: faker.person.fullName(),
        email: `info@${VENDOR_NAMES[i].replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 20)}.com`,
        phone: faker.phone.number({ style: 'national' }),
        address: faker.location.streetAddress(),
        city,
        country: 'Pakistan',
        taxId: `NTN-${faker.string.numeric(7)}-${faker.string.numeric(1)}`,
        paymentTerms: 30,
        creditLimit: faker.helpers.arrayElement([500000, 1000000, 2000000, 5000000, 10000000]),
        rating: faker.number.int({ min: 2, max: 5 }),
        bankAccountNumber: faker.finance.accountNumber(24),
        leadTimeDays: faker.number.int({ min: 3, max: 21 }),
      },
    })
    vendorIds.push(vendor.id)
    vendorIdsByIndex.push(vendor.id)

    await prisma.supplierContact.create({
      data: {
        vendorId: vendor.id,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        phone: faker.phone.number({ style: 'national' }),
        mobile: faker.phone.number({ style: 'national' }),
        jobTitle: faker.helpers.arrayElement(['Sales Manager', 'Account Manager', 'CEO', 'Director']),
        department: 'Sales',
        isPrimary: true,
      },
    })
  }

  console.log(` Vendors: ${vendorIds.length}`)

  return { vendorIds, vendorIdsByIndex }
}

export async function seedCustomers(
  prisma: PrismaClient,
): Promise<{ customerIds: string[]; customerIdsByIndex: string[] }> {
  console.log('\n--- Seeding Customers ---')

  const customerIds: string[] = []
  const customerIdsByIndex: string[] = []

  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const code = generateCustomerCode(i + 1)
    const city = faker.helpers.arrayElement(PAKISTAN_CITIES)

    const customer = await prisma.customer.create({
      data: {
        customerCode: code,
        name: CUSTOMER_NAMES[i],
        contactPerson: faker.person.fullName(),
        email: `info@${CUSTOMER_NAMES[i].replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 20)}.com`,
        phone: faker.phone.number({ style: 'national' }),
        address: faker.location.streetAddress(),
        city,
        country: 'Pakistan',
        taxId: `NTN-${faker.string.numeric(7)}-${faker.string.numeric(1)}`,
        creditLimit: faker.helpers.arrayElement([200000, 500000, 1000000, 2000000, 5000000]),
        paymentTerms: 30,
        isActive: true,
      },
    })
    customerIds.push(customer.id)
    customerIdsByIndex.push(customer.id)
  }

  console.log(` Customers: ${customerIds.length}`)
  return { customerIds, customerIdsByIndex }
}
