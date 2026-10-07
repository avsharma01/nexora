export type UserRole = 'admin' | 'analyst' | 'viewer';

export interface User {
  email: string;
  role: UserRole;
  token?: string;
}

export interface CompanyData {
  id?: number;
  n: string; // Company Name
  s: string; // Sector / Industry
  hq: string; // Headquarters
  f: number; // Founded Year
  e: string; // Employees
  rev: number[]; // 12-month revenue (₹ Cr)
  exp: number[]; // 12-month expenses (₹ Cr)
}

export type ViewKey = 'dash' | 'kpi' | 'ana' | 'fc' | 'ai' | 'wi';

export interface ViewMeta {
  key: ViewKey;
  label: string;
}

export interface ChatMessage {
  r: 'u' | 'a'; // 'u' for user, 'a' for analyst/assistant
  t: string;    // text
  s?: string | null; // source attribution
}

export interface QuarterlyStats {
  rq: number; // Last quarter revenue
  rp: number; // Prev quarter revenue
  eq: number; // Last quarter expenses
  ep: number; // Prev quarter expenses
  pq: number; // Last quarter profit
  pp: number; // Prev quarter profit
  rg: number; // Revenue growth %
  eg: number; // Expense growth %
  pg: number; // Profit growth %
  mg: number; // Profit margin %
}

export interface RegressionModel {
  s: number; // slope
  i: number; // intercept
}

export interface ScenarioResult {
  rev: number[];
  prof: number[];
}

export type BackendStatus = 'connected' | 'offline' | 'checking';
