export interface Eligibility {
  eligible: boolean;
  max_approved_amount: number;
  requested_amount: number;
  debt_to_income_ratio: number;
  rejection_reasons: string[];
  policy_version: string;
}
