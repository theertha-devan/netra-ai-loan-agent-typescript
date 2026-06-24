import type { Customer } from "./customer.js";
import type { Product } from "./product.js";

export interface Database {
  products: Product[];
  customers: Customer[];
}
