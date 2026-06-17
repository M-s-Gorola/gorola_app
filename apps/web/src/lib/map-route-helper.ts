export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export async function fetchOlaRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  apiKey: string
): Promise<[number, number][]> {
  const requestId = Math.random().toString(36).substring(2, 15);
  const url = `https://api.olamaps.io/routing/v1/directions?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&api_key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Request-Id": requestId
    }
  });

  if (!res.ok) {
    throw new Error(`Ola Routing API error: ${res.statusText}`);
  }

  const data = await res.json();
  const polyline = data?.routes?.[0]?.overview_polyline;
  const points = typeof polyline === "string" ? polyline : polyline?.points;
  if (!points) {
    throw new Error("No overview polyline points found in response");
  }

  return decodePolyline(points);
}
