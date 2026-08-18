export const API = import.meta.env.VITE_API_URL || "/api";

export type Transaction = {
  id: string;
  type: "income" | "expense";
  description: string;
  category: string;
  amount: number;
  date: string;
};

export type Summary = {
  income: number;
  expenses: number;
  balance: number;
  transactions: number;
  categoryTotals: { category: string; total: number }[];
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("sme_token");
  const res = await fetch(`${API}${path}`, {
    headers: {
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(options?.headers || {})
}),
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  transactions: (params = "") => request<Transaction[]>(`/transactions${params}`),
  categories: () => request<{id:number;name:string}[]>("/categories"),
  summary: () => request<Summary>("/summary"),
  create: (data: Omit<Transaction,"id">) => request<Transaction>("/transactions", { method:"POST", body:JSON.stringify(data) }),
  update: (id:string, data: Omit<Transaction,"id">) => request<Transaction>(`/transactions/${id}`, { method:"PUT", body:JSON.stringify(data) }),
  remove: (id:string) => request<void>(`/transactions/${id}`, { method:"DELETE" })
};
