import { CompanyData, UserRole, ViewKey, ViewMeta } from './types';

export const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
export const FORECAST_MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

export const DEFAULT_COMPANIES: CompanyData[] = [
  {
    id: 1,
    n: 'Bharat FinServe Ltd',
    s: 'Retail Banking',
    hq: 'Mumbai',
    f: 2009,
    e: '4,200',
    rev: [42, 44, 43, 47, 49, 52, 51, 55, 58, 57, 61, 64],
    exp: [36, 37, 37, 39, 41, 43, 43, 45, 47, 47, 49, 51],
  },
  {
    id: 2,
    n: 'Kisan Wealth Advisors',
    s: 'Wealth Management',
    hq: 'Pune',
    f: 2014,
    e: '380',
    rev: [18, 19, 19, 21, 20, 22, 24, 23, 25, 27, 26, 29],
    exp: [15, 16, 15, 17, 17, 18, 19, 19, 20, 21, 21, 22],
  },
  {
    id: 3,
    n: 'Sahaj Payments',
    s: 'Payments / Fintech',
    hq: 'Bengaluru',
    f: 2017,
    e: '910',
    rev: [30, 31, 35, 33, 36, 38, 37, 41, 40, 44, 43, 47],
    exp: [27, 27, 30, 29, 31, 32, 33, 35, 34, 37, 37, 39],
  },
];

export const DEMO_USERS: Record<string, UserRole> = {
  'admin@nexora.io': 'admin',
  'analyst@nexora.io': 'analyst',
  'viewer@nexora.io': 'viewer',
};

export const DEMO_PASSWORD = 'demo123';

export const VIEWS: ViewMeta[] = [
  { key: 'dash', label: 'Dashboard' },
  { key: 'kpi', label: 'Company & KPIs' },
  { key: 'ana', label: 'Analytics' },
  { key: 'fc', label: 'Forecast' },
  { key: 'ai', label: 'AI Analyst' },
  { key: 'wi', label: 'What-If' },
];

export const ACCESS: Record<UserRole, ViewKey[]> = {
  admin: ['dash', 'kpi', 'ana', 'fc', 'ai', 'wi'],
  analyst: ['dash', 'kpi', 'ana', 'fc', 'ai', 'wi'],
  viewer: ['dash', 'kpi', 'ana', 'fc'],
};

export const REVENUE_MIX: [string, number][][] = [
  [
    ['Retail loans', 45],
    ['Deposits & fees', 25],
    ['Cards', 18],
    ['Treasury', 12],
  ],
  [
    ['Advisory fees', 50],
    ['AUM fees', 30],
    ['Insurance', 20],
  ],
  [
    ['UPI / payments', 55],
    ['Merchant services', 30],
    ['Lending API', 15],
  ],
];

export const COST_MIX: [string, number][][] = [
  [
    ['Salaries', 38],
    ['Operations', 24],
    ['Technology', 16],
    ['Compliance', 14],
    ['Marketing', 8],
  ],
  [
    ['Salaries', 52],
    ['Operations', 18],
    ['Technology', 10],
    ['Compliance', 12],
    ['Marketing', 8],
  ],
  [
    ['Salaries', 28],
    ['Operations', 20],
    ['Technology', 32],
    ['Compliance', 12],
    ['Marketing', 8],
  ],
];

export const SUGGESTED_QUESTIONS = [
  'What was revenue last quarter?',
  'How did profit change versus the previous quarter?',
  'What is the current profit margin?',
  'Which month had the highest revenue?',
  'What does the forecast say for next month?',
];
