import type { CreditReport } from "./credit-report.js";
import type { FinancialProfile } from "./financial-profile.js";
import type { Eligibility } from "./eligibility.js";

export interface Customer {
  customer_id: string;
  verified: boolean;
  full_name: string;
  kyc_status: string;
  risk_flag: string;
  credit_report: CreditReport;
  financial_profile: FinancialProfile;
  pan: string;
  aadhaar: string;
  phone: string;
  eligibility?: Eligibility;
}
