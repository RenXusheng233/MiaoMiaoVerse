import type { DailyCatResponse } from "@/lib/types/cat";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
}

export async function getDailyCat(): Promise<DailyCatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/daily-cat`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch daily cat: ${res.status}`);
  }
  return res.json();
}

export async function getRandomCat(
  excludeId?: string
): Promise<DailyCatResponse> {
  const url = new URL(`${API_BASE_URL}/api/daily-cat/random`);
  if (excludeId) {
    url.searchParams.set("exclude_id", excludeId);
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch random cat: ${res.status}`);
  }
  return res.json();
}
