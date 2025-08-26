import {supabase} from '../lib/supabaseClinet';
import type {Location} from '../types/location';
export function subscribeToLocation(callback: (loc: Location) => void) {
  const channel = supabase
    .channel('realtime:locations')
    .on(
      'postgres_changes',
      {event: '*', schema: 'public', table: 'user_locations'},
      (payload) => {
        callback(payload.new as Location);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
