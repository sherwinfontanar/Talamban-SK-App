'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const BOUNDARY_STYLE = {
  color: '#1f4d3d', // --primary
  weight: 2.5,
  fillColor: '#1f4d3d',
  fillOpacity: 0.12,
};

export default function BoundaryMap() {
  const [feature, setFeature] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/talamban-boundary.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load boundary data');
        return res.json();
      })
      .then((data) => setFeature(data.features[0]))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <p className="muted">{error}</p>;
  }

  if (!feature) {
    return <p className="muted">Loading map…</p>;
  }

  // Coordinates are [lng, lat]; Leaflet wants [lat, lng].
  const ring = feature.geometry.coordinates[0];
  const bounds = ring.map(([lng, lat]) => [lat, lng]);

  return (
    <div>
      <div className="boundary-map">
        <MapContainer bounds={bounds} boundsOptions={{ padding: [24, 24] }} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON data={feature} style={() => BOUNDARY_STYLE} />
        </MapContainer>
      </div>
      <p className="field-hint" style={{ marginTop: '0.5rem' }}>
        Boundary is a simplified outline (~{feature.properties.area_sqkm} km²), not a precise
        cadastral survey. Source: {feature.properties.source}.
      </p>
    </div>
  );
}