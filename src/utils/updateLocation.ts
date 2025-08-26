import {supabase} from '../lib/supabaseClinet';

interface updateLocationProps {
  userId: string;
  latitude: number;
  longitude: number;
}

export async function updateLocation({
  userId,
  latitude,
  longitude,
}: updateLocationProps) {
  const {error} = await supabase.from('user_locations').upsert({
    user_id: userId,
    latitude,
    longitude,
    updated_at: new Date().toISOString(),
  });

  if (error) console.error('Error updating location:', error);
}
