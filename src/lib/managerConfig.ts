import { hasSupabaseConfig, supabase } from './supabase';

export type ManagerConfig = {
  id: string;
  manager_name: string;
  owner_percentage: number;
  manager_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ManagerConfigInput = {
  manager_name: string;
  owner_percentage: number;
  manager_percentage: number;
  is_active?: boolean;
};

/**
  Normalizes manager names by trimming outer spaces and collapsing internal consecutive whitespace
 */
export function normalizeManagerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
  Finds manager configuration matching name (case-insensitive & whitespace-normalized)
 */
export function findManagerConfig(
  configs: ManagerConfig[],
  name: string
): ManagerConfig | undefined {
  const target = normalizeManagerName(name).toLowerCase();
  if (!target) return undefined;
  return configs.find((config) => normalizeManagerName(config.manager_name).toLowerCase() === target);
}

/**
  Fetches all manager configurations directly from Supabase
 */
export async function fetchManagerConfigs(): Promise<ManagerConfig[]> {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('manager_configs')
    .select('*')
    .order('manager_name', { ascending: true });

  if (error) {
    console.error('Failed to fetch manager configs from Supabase:', error);
    return [];
  }

  return (data ?? []) as ManagerConfig[];
}

/**
  Creates or updates a manager configuration in Supabase
 */
export async function createOrUpdateManagerConfig(
  input: ManagerConfigInput,
  existingId?: string
): Promise<{ data: ManagerConfig | null; error: string | null }> {
  if (!hasSupabaseConfig || !supabase) {
    return { data: null, error: 'Add Supabase credentials to .env before managing manager rules.' };
  }

  const cleanName = normalizeManagerName(input.manager_name);

  if (!cleanName) {
    return { data: null, error: 'Manager name is required.' };
  }

  if (input.owner_percentage < 0 || input.owner_percentage > 100) {
    return { data: null, error: 'Owner percentage must be between 0 and 100.' };
  }

  if (input.manager_percentage < 0 || input.manager_percentage > 100) {
    return { data: null, error: 'Manager percentage must be between 0 and 100.' };
  }

  if (input.owner_percentage + input.manager_percentage !== 100) {
    return { data: null, error: 'Owner percentage and Manager percentage must sum to 100%.' };
  }

  const now = new Date().toISOString();

  if (existingId) {
    const { data, error } = await supabase
      .from('manager_configs')
      .update({
        manager_name: cleanName,
        owner_percentage: Math.round(input.owner_percentage),
        manager_percentage: Math.round(input.manager_percentage),
        is_active: input.is_active ?? true,
        updated_at: now,
      })
      .eq('id', existingId)
      .select('*')
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return { data: data as ManagerConfig, error: null };
  }

  // Check unique name constraint
  const existingConfigs = await fetchManagerConfigs();
  const duplicate = findManagerConfig(existingConfigs, cleanName);
  if (duplicate) {
    return { data: null, error: `A manager configuration for "${cleanName}" already exists.` };
  }

  const { data, error } = await supabase
    .from('manager_configs')
    .insert({
      manager_name: cleanName,
      owner_percentage: Math.round(input.owner_percentage),
      manager_percentage: Math.round(input.manager_percentage),
      is_active: input.is_active ?? true,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) {
    return { data: null, error: error.message };
  }
  return { data: data as ManagerConfig, error: null };
}

/**
  Soft-deletes (toggles active status) a manager configuration
 */
export async function toggleManagerActiveStatus(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error: string | null }> {
  if (!hasSupabaseConfig || !supabase) {
    return { success: false, error: 'Add Supabase credentials to .env before managing manager rules.' };
  }

  const { error } = await supabase
    .from('manager_configs')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}
