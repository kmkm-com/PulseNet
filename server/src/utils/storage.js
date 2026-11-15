import { createClient } from '@supabase/supabase-js';
import '../config/env.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Public URL of a file in a public bucket (built locally, no network call)
export const publicUrl = (bucket, path) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

/**
 * Upload buffer to Supabase Storage bucket
 */
export async function uploadFileToStorage(bucket, path, buffer, contentType) {
  if (!supabase) {
    throw new Error(
      'Supabase Storage is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.'
    );
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw error;
  
  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return {
    path,
    publicUrl: publicData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
  };
}

/**
 * Remove file from Supabase Storage bucket
 */
export async function removeFileFromStorage(bucket, path) {
  if (!supabase) {
    throw new Error(
      'Supabase Storage is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.'
    );
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  if (error) console.error(`Error removing ${path} from ${bucket}:`, error);
  return data;
}
