export interface Product {
  product_id: string;
  name: string;
  interest_rate_annual_pct: number;
  min_credit_score: number;
  available_tenures_months: number[];
  processing_fee_pct: number;
  max_amount: number;
}
