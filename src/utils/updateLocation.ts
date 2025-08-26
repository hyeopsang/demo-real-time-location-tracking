import {supabase} from '../lib/supabaseClinet';

export async function updateLocation(
  userId: string,
  latitude: number,
  longitude: number
) {
  const {error} = await supabase.from('user_locations').upsert({
    user_id: userId,
    latitude,
    longitude,
    updated_at: new Date().toISOString(),
  });

  if (error) console.error('Error updating location:', error);
}
