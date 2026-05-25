import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export interface ReferenceItem {
  id: string;
  code: string;
  name: string;
  sort_order?: number;
  color?: string;
  is_active?: boolean;
}

export interface ReferenceData {
  'question-types': ReferenceItem[];
  'difficulty-levels': ReferenceItem[];
  'grade-levels': ReferenceItem[];
  'paper-statuses': ReferenceItem[];
  'error-types': ReferenceItem[];
  'question-sources': ReferenceItem[];
  'provinces': ReferenceItem[];
  'subjects': ReferenceItem[];
}

const EMPTY: ReferenceData = {
  'question-types': [],
  'difficulty-levels': [],
  'grade-levels': [],
  'paper-statuses': [],
  'error-types': [],
  'question-sources': [],
  'provinces': [],
  'subjects': [],
};

// Module-level singleton cache
let cache: ReferenceData | null = null;
let fetchPromise: Promise<ReferenceData> | null = null;
const listeners: Set<() => void> = new Set();

async function fetchAll(): Promise<ReferenceData> {
  const { data } = await apiClient.get('/reference/all');
  cache = data as ReferenceData;
  listeners.forEach(fn => fn());
  return cache;
}

export function useReferenceValues(): ReferenceData {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!cache) {
      if (!fetchPromise) {
        fetchPromise = fetchAll();
      }
      fetchPromise.then(() => setTick(t => t + 1));
    }
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return cache ?? EMPTY;
}

// ─── Utility helpers ───

export function toLabelMap(items: ReferenceItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  items.forEach(item => { map[item.code] = item.name; });
  return map;
}

export function toSelectOptions(items: ReferenceItem[]): { value: string; label: string }[] {
  return items.map(item => ({ value: item.code, label: item.name }));
}

export function toColorMap(items: ReferenceItem[]): Record<string, { color: string; label: string }> {
  const map: Record<string, { color: string; label: string }> = {};
  items.forEach(item => {
    map[item.code] = { color: item.color || 'default', label: item.name };
  });
  return map;
}
