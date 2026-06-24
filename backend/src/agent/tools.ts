import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getDb } from "../db/index.js";
import Netra from "netra-sdk";

export const verifyIdentity = tool(
  async ({ identifierType, identifierValue }) => {
    try {
      const db = getDb();
      if (!["PAN", "AADHAAR", "PHONE"].includes(identifierType.toUpperCase())) {
        return JSON.stringify({ error: "invalid identifier type" });
      }

      const identifierKey = identifierType.toLowerCase();
      const customer = db.customers.find(
        (c) => (c as any)[identifierKey] === identifierValue,
      );

      if (!customer) {
        return JSON.stringify({ error: "Customer does not exist" });
      }

      Netra.setUserId(customer.customer_id);

      return JSON.stringify({
        verified: customer.verified,
        customer_id: customer.customer_id,
        full_name: customer.full_name,
        kyc_status: customer.kyc_status,
        risk_flag: customer.risk_flag,
      });
    } catch (error: any) {
      console.error(
        `verifyIdentity - Unexpected error: identifierType=${identifierType}, identifierValue=${identifierValue}, error=${error.message}`,
      );
      return JSON.stringify({ error: "An error occurred" });
    }
  },
  {
    name: "verify_identity",
    description:
      "Verify customer identity using PAN, Aadhaar, or phone number. Must be called before any other tool.",
    schema: z.object({
      identifierType: z
        .string()
        .describe('one of these values - "PAN", "AADHAAR", "PHONE"'),
      identifierValue: z.string().describe("value of the identifier type"),
    }),
  },
);

export const fetchCreditReport = tool(
  async ({ customerId }) => {
    try {
      const db = getDb();
      const customer = db.customers.find((c) => c.customer_id === customerId);

      if (!customer) {
        return JSON.stringify({ error: "Customer does not exist" });
      }

      return JSON.stringify(customer.credit_report);
    } catch (error: any) {
      console.error(
        `fetchCreditReport - Unexpected error: customerId=${customerId}, error=${error.message}`,
      );
      return JSON.stringify({ error: "An error occurred" });
    }
  },
  {
    name: "fetch_credit_report",
    description: "Fetch credit score and loan history for a verified customer.",
    schema: z.object({
      customerId: z.string().describe("The customer id of the customer"),
    }),
  },
);

export const fetchFinancialProfile = tool(
  async ({ customerId }) => {
    try {
      const db = getDb();
      const customer = db.customers.find((c) => c.customer_id === customerId);

      if (!customer) {
        return JSON.stringify({ error: "Customer does not exist" });
      }

      return JSON.stringify(customer.financial_profile);
    } catch (error: any) {
      console.error(
        `fetchFinancialProfile - Unexpected error: customerId=${customerId}, error=${error.message}`,
      );
      return JSON.stringify({ error: "An error occurred" });
    }
  },
  {
    name: "fetch_financial_profile",
    description:
      "Fetch income, employment, and banking details for a verified customer.",
    schema: z.object({
      customerId: z.string().describe("The customer id of the customer"),
    }),
  },
);

export const searchLoanProducts = tool(
  async ({ creditScore }) => {
    try {
      const db = getDb();
      const products = db.products.filter(
        (product) => product.min_credit_score <= creditScore,
      );

      return JSON.stringify({ loan_products: products });
    } catch (error: any) {
      console.error(
        `searchLoanProducts - Error: creditScore=${creditScore}, error=${error.message}`,
      );
      return JSON.stringify({ error: "An error occurred" });
    }
  },
  {
    name: "search_loan_products",
    description:
      "Search available loan products matching the customer's profile and approved amount",
    schema: z.object({
      approvedAmount: z
        .number()
        .describe("The maximum loan amount approved for the customer"),
      creditScore: z.number().describe("The customer's current credit score"),
      employmentType: z
        .string()
        .describe(
          'Type of employment (e.g., "salaried", "self-employed", "business")',
        ),
    }),
  },
);

export const checkEligibility = tool(
  async ({
    customerId,
    creditScore,
    monthlyIncome,
    requestedAmount,
    loanTenureMonths,
  }) => {
    try {
      const db = getDb();
      const customer = db.customers.find((c) => c.customer_id === customerId);

      if (!customer) {
        return JSON.stringify({ error: "Customer does not exist" });
      }

      const dti = customer.credit_report.defaults_last_3_years / monthlyIncome;

      const eligibleLoanProducts = db.products
        .filter((product) => product.min_credit_score <= creditScore)
        .sort((a, b) => a.max_amount - b.max_amount);

      const eligibleLoanProductsByTenure = db.products.filter((product) =>
        product.available_tenures_months.includes(loanTenureMonths),
      );

      const apprRequestedAmount = Math.ceil(requestedAmount / 100000) * 100000;

      const eligibilityPayload = {
        eligible: true,
        max_approved_amount: 0,
        requested_amount: apprRequestedAmount,
        debt_to_income_ratio: dti,
        rejection_reasons: [] as string[],
        policy_version: "v3.2.1",
      };

      if (dti > 0.5) {
        eligibilityPayload.eligible = false;
        eligibilityPayload.rejection_reasons.push(
          `Debt-to-income ratio of ${dti} exceeds maximum of 0.50`,
        );
      }

      if (eligibleLoanProducts.length === 0) {
        eligibilityPayload.eligible = false;
        eligibilityPayload.rejection_reasons.push(
          `Credit score ${creditScore} is below minimum threshold of 600`,
        );
      } else {
        eligibilityPayload.max_approved_amount = Math.min(
          apprRequestedAmount,
          eligibleLoanProducts[eligibleLoanProducts.length - 1].max_amount,
        );
      }

      if (eligibleLoanProductsByTenure.length === 0) {
        eligibilityPayload.eligible = false;
        eligibilityPayload.rejection_reasons.push(
          `Requested tenure of ${loanTenureMonths} months is not available.`,
        );
      }

      if (
        eligibleLoanProducts.length > 0 &&
        eligibleLoanProducts[eligibleLoanProducts.length - 1].max_amount <
          requestedAmount
      ) {
        eligibilityPayload.eligible = false;
        eligibilityPayload.rejection_reasons.push(
          `Requested amount of Rs.${requestedAmount} is more than the maximum loanable amount`,
        );
      }

      return JSON.stringify(eligibilityPayload);
    } catch (error: any) {
      console.error(
        `checkEligibility - Unexpected error: customerId=${customerId}, error=${error.message}`,
      );
      return JSON.stringify({ error: "An error occurred" });
    }
  },
  {
    name: "check_eligibility",
    description:
      "Check loan eligibility based on credit and financial profile. Returns maximum approved amount and a decision on eligibility.",
    schema: z.object({
      customerId: z.string().describe("The customer id of the customer"),
      creditScore: z.number().describe("The customer's current credit score"),
      monthlyIncome: z.number().describe("The customer's monthly income"),
      existingMonthlyEmi: z
        .number()
        .describe("The customer's existing monthly EMI obligations"),
      requestedAmount: z
        .number()
        .describe("The loan amount requested by the customer"),
      employmentType: z.string().describe("Type of employment"),
      loanTenureMonths: z.number().describe("Requested loan tenure in months"),
    }),
  },
);

export const calculateEmi = tool(
  async ({ principal, annualRatePct, tenureMonths }) => {
    try {
      const r = annualRatePct / 12 / 100;
      const emi =
        (principal * r * Math.pow(1 + r, tenureMonths)) /
        (Math.pow(1 + r, tenureMonths) - 1);

      return JSON.stringify({ emi });
    } catch (error: any) {
      console.error(
        `calculateEmi - Error: principal=${principal}, annualRatePct=${annualRatePct}, tenureMonths=${tenureMonths}, error=${error.message}`,
      );
      return JSON.stringify({ error: "An error occurred" });
    }
  },
  {
    name: "calculate_emi",
    description:
      "Calculate exact EMI for a given loan amount, interest rate, and tenure.",
    schema: z.object({
      principal: z.number().describe("The loan principal amount"),
      annualRatePct: z
        .number()
        .describe("The annual interest rate as a percentage"),
      tenureMonths: z.number().describe("The loan tenure in months"),
    }),
  },
);

export const generatePreApproval = tool(
  async () => {
    try {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      return JSON.stringify({
        pre_approval_id: "PA-2026-00142",
        status: "pre_approved",
        valid_until: nextWeek.toISOString().split("T")[0],
        disclaimer:
          "This pre-approval is subject to final verification and does not guarantee loan disbursal. Please visit your nearest Meridian Bank branch with original documents to complete the application.",
        next_steps: [
          "Visit nearest Meridian Bank branch with original PAN and Aadhaar",
          "Carry latest 3 months salary slips and bank statements",
          "Complete full application within 30 days of this pre-approval",
        ],
      });
    } catch (error: any) {
      console.error(`generatePreApproval - Error: ${error.message}`);
      return JSON.stringify({ error: "An error occurred" });
    }
  },
  {
    name: "generate_pre_approval",
    description:
      "Generate a pre-approval reference for the selected loan product.",
    schema: z.object({
      customerId: z
        .string()
        .describe(
          "The unique identifier of the customer requesting the pre-approval.",
        ),
      productId: z
        .string()
        .describe("The unique identifier of the loan product."),
      amount: z
        .number()
        .describe("The loan amount requested in the base currency unit."),
      annualRatePct: z
        .number()
        .describe("The annual interest rate as a percentage."),
      tenureMonths: z
        .number()
        .describe("The loan tenure or duration in months."),
    }),
  },
);
