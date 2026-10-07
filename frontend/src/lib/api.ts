const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface BackendCompany {
  id: number;
  name: string;
  industry?: string | null;
  description?: string | null;
}

export interface BackendKPI {
  id: number;
  company_id: number;
  metric_name: string;
  metric_value: number;
  metric_date: string;
}

export interface BackendMetricAnalytics {
  metric_name: string;
  latest_value: number | null;
  latest_date: string | null;
  previous_value: number | null;
  previous_date: string | null;
  change: number | null;
  change_percentage: number | null;
  comparison_available: boolean;
}

export interface BackendAnalyticsResponse {
  company_id: number;
  metrics: BackendMetricAnalytics[];
}

export interface BackendForecastPoint {
  forecast_date: string;
  forecast_value: number;
}

export interface BackendForecastResponse {
  company_id: number;
  metric_name: string;
  historical_latest_value: number | null;
  forecasts: BackendForecastPoint[];
}

export interface BackendAIResponse {
  company_id: number;
  question: string;
  answer: string;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

export async function loginToBackend(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to authenticate with backend');
  }
  return res.json();
}

export async function fetchCompanies(token?: string): Promise<BackendCompany[]> {
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/companies/`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch companies');
  return res.json();
}

export async function fetchCompanyKPIs(companyId: number, token?: string): Promise<BackendKPI[]> {
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/companies/${companyId}/kpis`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch KPIs for company ${companyId}`);
  return res.json();
}

export async function updateKPIOnBackend(
  kpiId: number,
  metricValue: number,
  token?: string
): Promise<BackendKPI> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/kpis/${kpiId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ metric_value: metricValue }),
  });
  if (!res.ok) throw new Error(`Failed to update KPI ${kpiId}`);
  return res.json();
}

export async function fetchBackendAnalytics(companyId: number, token?: string): Promise<BackendAnalyticsResponse> {
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/companies/${companyId}/analytics`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch analytics for company ${companyId}`);
  return res.json();
}

export async function fetchBackendForecast(
  companyId: number,
  metricName: string = 'Revenue',
  periods: number = 6,
  token?: string
): Promise<BackendForecastResponse> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/companies/${companyId}/forecast`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ metric_name: metricName, periods }),
  });
  if (!res.ok) throw new Error(`Failed to forecast for company ${companyId}`);
  return res.json();
}

export async function fetchBackendAIAnalysis(
  companyId: number,
  question: string,
  token?: string
): Promise<BackendAIResponse> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/companies/${companyId}/ai-analysis`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`Failed to get AI analysis`);
  return res.json();
}
