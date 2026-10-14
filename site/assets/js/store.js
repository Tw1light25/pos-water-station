/**
 * Settings + catalogue loader with a localStorage cache, so the site still
 * renders (with the last known data) when the phone has no signal.
 */

import { api } from './api.js';

const CACHE_KEY = 'pos.cache.v2';

export function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(patch) {
  const next = { ...readCache(), ...patch, cached_at: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked - not fatal */
  }
  return next;
}

export async function loadSettings() {
  try {
    const data = await api('/api/settings');
    writeCache({ settings: data.settings, status: data.status });
    return { settings: data.settings, status: data.status, offline: false };
  } catch (error) {
    const cache = readCache();
    if (cache.settings) {
      return { settings: cache.settings, status: cache.status ?? null, offline: true, cachedAt: cache.cached_at };
    }
    throw error;
  }
}

export async function loadProducts() {
  try {
    const data = await api('/api/products');
    writeCache({ products: data.products });
    return { products: data.products, offline: false };
  } catch (error) {
    const cache = readCache();
    if (cache.products) return { products: cache.products, offline: true };
    throw error;
  }
}
