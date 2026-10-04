import { BudgetPeriod } from '../enums/budget-period';
import { CategoryReference } from './category-output-dto';
import { MerchantTotalDto } from './transaction-breakdown-output-dto';

/** How often a recurring payment comes. */
export type RecurringCadence = 'Weekly' | 'Biweekly' | 'Monthly' | 'Quarterly' | 'Yearly';

/** Active: on schedule. Late: past due, not by a whole period yet. Stopped: no charge for over a period. */
export type RecurringStatus = 'Active' | 'Late' | 'Stopped';

/** A payment that comes again and again (a subscription, a bill, rent), found in the spending. */
export interface RecurringPaymentDto {
  /** The merchant: its rule's keyword, or the start of its description. */
  name: string;
  cadence: RecurringCadence;
  status: RecurringStatus;
  /** The latest charge for a fixed price, the average of the last three when it varies. */
  amount: number;
  variableAmount: boolean;
  firstDate: string;
  lastDate: string;
  lastAmount: number;
  nextDate: string;
  count: number;
  monthlyCost: number;
  yearlyCost: number;
  category: CategoryReference | null;
  /** A fixed price that changed with the latest charge. */
  priceChange: { from: number; to: number; since: string } | null;
}

export interface RecurringReportDto {
  /** Active and late ones by monthly cost, then stopped ones, latest first. */
  payments: RecurringPaymentDto[];
  /** Of the active and late ones. */
  monthlyTotal: number;
  yearlyTotal: number;
}

export interface UpcomingChargeDto {
  name: string;
  amount: number;
  date: string;
}

export interface BudgetForecastDto {
  budgetId: string;
  name: string;
  period: BudgetPeriod;
  amount: number;
  spent: number;
  /** Where it should end, this month or this year, at its usual pace. */
  projected: number;
  projectedPercentage: number;
}

/** Where this month's spending is heading. */
export interface SpendingForecastDto {
  /** "October 2026". */
  month: string;
  daysInMonth: number;
  /** Days after today until the month ends. */
  daysLeft: number;
  spent: number;
  projected: number;
  /** The average of the last complete months (up to three); null with none. */
  usual: number | null;
  usualMonths: number;
  /** Day-to-day spending a day (recurring payments left out) the days left are projected at. */
  dailyRate: number;
  upcoming: UpcomingChargeDto[];
  budgets: BudgetForecastDto[];
}

/** A merchant whose spending landed in Other because no rule names it. */
export interface UncategorisedMerchantDto {
  /** The keyword to suggest for a rule. */
  keyword: string;
  count: number;
  spending: number;
  examples: string[];
  lastDate: string;
}

export interface UncategorisedReportDto {
  merchants: UncategorisedMerchantDto[];
  /** Every transaction a rule could sort, across all of them. */
  transactionCount: number;
}

export interface ReviewCategoryDto {
  category: CategoryReference;
  spending: number;
  previousSpending: number;
}

/** A month or a year looked back on, against the one before. */
export interface ReviewReportDto {
  /** "September 2026", or "2026". */
  label: string;
  year: number;
  /** Null for a year. */
  month: number | null;
  start: string;
  end: string;
  /** False while the period is still running. */
  complete: boolean;
  previousLabel: string;
  spending: number;
  previousSpending: number;
  income: number;
  previousIncome: number;
  purchases: number;
  noSpendDays: number;
  categories: ReviewCategoryDto[];
  topMerchants: MerchantTotalDto[];
  biggestPurchase: {
    description: string;
    amount: number;
    date: string;
    category: CategoryReference | null;
  } | null;
  /** For a year: each month so far. */
  months: { label: string; spending: number; income: number }[];
  recurringCount: number;
  recurringMonthlyTotal: number;
  /** The first month with data, "2025-03". */
  earliest: string | null;
}
