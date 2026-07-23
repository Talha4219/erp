// UK 2024/25 tax year rates
const PAYE = {
  personalAllowance: 12570,
  basicRateTop: 50270,
  higherRateTop: 125140,
  basicRate: 0.2,
  higherRate: 0.4,
  additionalRate: 0.45,
}

const NI = {
  primaryThreshold: 12570,
  upperEarningsLimit: 50270,
  secondaryThreshold: 9100,
  employeeRate: 0.08,
  employeeUpperRate: 0.02,
  employerRate: 0.138,
}

const PENSION = {
  lowerQualifyingEarnings: 6240,
  upperQualifyingEarnings: 50270,
  employeeRate: 0.05,
  employerRate: 0.03,
}

export interface UKPayrollResult {
  grossSalary: number
  payeDeduction: number
  niEmployee: number
  niEmployer: number
  pensionEmployee: number
  pensionEmployer: number
  totalDeductions: number
  netSalary: number
}

export function calculateUKPayroll(
  annualBasic: number,
  annualAllowances: number,
  annualOvertime: number,
  pensionEnrolled: boolean
): UKPayrollResult {
  const annualGross = annualBasic + annualAllowances + annualOvertime

  // PAYE
  const taxable = Math.max(0, annualGross - PAYE.personalAllowance)
  let annualPAYE = 0
  if (taxable > 0) {
    const basicBand = Math.min(taxable, PAYE.basicRateTop - PAYE.personalAllowance)
    annualPAYE += basicBand * PAYE.basicRate
    if (taxable > PAYE.basicRateTop - PAYE.personalAllowance) {
      const higherBand = Math.min(
        taxable - (PAYE.basicRateTop - PAYE.personalAllowance),
        PAYE.higherRateTop - PAYE.basicRateTop
      )
      annualPAYE += higherBand * PAYE.higherRate
      if (taxable > PAYE.higherRateTop - PAYE.personalAllowance) {
        annualPAYE += (taxable - (PAYE.higherRateTop - PAYE.personalAllowance)) * PAYE.additionalRate
      }
    }
  }

  // NI employee
  let annualNIEmployee = 0
  if (annualGross > NI.primaryThreshold) {
    const lower = Math.min(annualGross, NI.upperEarningsLimit) - NI.primaryThreshold
    annualNIEmployee += lower * NI.employeeRate
    if (annualGross > NI.upperEarningsLimit) {
      annualNIEmployee += (annualGross - NI.upperEarningsLimit) * NI.employeeUpperRate
    }
  }

  // NI employer
  let annualNIEmployer = 0
  if (annualGross > NI.secondaryThreshold) {
    annualNIEmployer = (annualGross - NI.secondaryThreshold) * NI.employerRate
  }

  // Pension (auto-enrolment on qualifying earnings)
  let annualPensionEmployee = 0
  let annualPensionEmployer = 0
  if (pensionEnrolled) {
    const qualifying = Math.max(
      0,
      Math.min(annualGross, PENSION.upperQualifyingEarnings) - PENSION.lowerQualifyingEarnings
    )
    annualPensionEmployee = qualifying * PENSION.employeeRate
    annualPensionEmployer = qualifying * PENSION.employerRate
  }

  const r2 = (n: number) => Math.round(n * 100) / 100
  const monthlyGross = r2(annualGross / 12)
  const monthlyPAYE = r2(annualPAYE / 12)
  const monthlyNIEmployee = r2(annualNIEmployee / 12)
  const monthlyNIEmployer = r2(annualNIEmployer / 12)
  const monthlyPensionEmployee = r2(annualPensionEmployee / 12)
  const monthlyPensionEmployer = r2(annualPensionEmployer / 12)

  const totalDeductions = r2(monthlyPAYE + monthlyNIEmployee + monthlyPensionEmployee)
  const netSalary = r2(monthlyGross - totalDeductions)

  return {
    grossSalary: monthlyGross,
    payeDeduction: monthlyPAYE,
    niEmployee: monthlyNIEmployee,
    niEmployer: monthlyNIEmployer,
    pensionEmployee: monthlyPensionEmployee,
    pensionEmployer: monthlyPensionEmployer,
    totalDeductions,
    netSalary,
  }
}
