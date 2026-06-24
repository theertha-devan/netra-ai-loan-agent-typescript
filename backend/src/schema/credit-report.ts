export interface ActiveLoan {
  type: string;
  outstanding: number;
  monthly_emi: number;
}

export interface CreditReport {
  credit_score: number;
  active_loans: ActiveLoan[];
  defaults_last_3_years: number;
  credit_utilization_pct: number;
}
