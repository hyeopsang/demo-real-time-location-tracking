import {updateLocation} from './updateLocation';

export function useGeoLocation(userId: string) {
  if (!navigator.geolocation) {
    alert('Geolocation not supported');
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => updateLocation(userId, pos.coords.latitude, pos.coords.longitude),
    (err) => console.error(err),
    {enableHighAccuracy: true, maximumAge: 10000, timeout: 5000}
  );
}
