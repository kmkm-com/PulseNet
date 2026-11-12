import { createClient } from '@supabase/supabase-js';
import '../config/env.js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vsuqxguawnxtodcuajij.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_ID83pmexw6HHj-AVEgk0nw_glhLQjq9';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Upload buffer to Supabase Storage bucket
 */
export async function uploadFileToStorage(bucket, path, buffer, contentType) {
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
  const { data, error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  if (error) console.error(`Error removing ${path} from ${bucket}:`, error);
  return data;
}
