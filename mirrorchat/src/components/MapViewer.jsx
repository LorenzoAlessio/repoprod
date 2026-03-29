import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Icona personalizzata CSS-based (usa gli emoji)
export function getCategoryInfo(category) {
  const map = {
    pharmacy: { icon: '⚕️', label: 'Farmacia', color: '#5B9A8B' },
    hospital: { icon: '🏥', label: 'Ospedale', color: '#C14433' },
    clinic: { icon: '🏥', label: 'Ospedale', color: '#C14433' },
    police: { icon: '🛡️', label: 'Forze dell\'Ordine', color: '#1B3A4B' },
    social_facility: { icon: '🤝', label: 'Centro d\'Ascolto', color: '#E8A838' },
    mall: { icon: '🏪', label: 'Centro Commerciale', color: '#7DB8A8' },
    supermarket: { icon: '🛒', label: 'Supermercato', color: '#7DB8A8' },
    townhall: { icon: '🏛️', label: 'Comune/Municipio', color: '#C8C4BC' },
    library: { icon: '📚', label: 'Biblioteca', color: '#C8C4BC' },
    community_centre: { icon: '👥', label: 'Centro Sociale', color: '#E8A838' },
  };

  const matched = Object.keys(map).find(k => category && category.includes(k));
  if (matched) return map[matched];
  return { icon: '📍', label: 'Punto Sicuro', color: '#0D1B2A' };
}

const getIconForCategory = (category, isUser = false) => {
  if (isUser) {
    return L.divIcon({
      html: `<div style="font-size:24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🧑‍🦯</div>`,
      className: 'custom-user-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    });
  }

  const info = getCategoryInfo(category);
  return L.divIcon({
    html: `<div style="
      background: white; 
      border: 2px solid ${info.color}; 
      border-radius: 50%; 
      width: 32px; 
      height: 32px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-size: 18px;
      box-shadow: 0 4px 12px rgba(13,27,42,0.12);
    ">${info.icon}</div>`,
    className: 'custom-place-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

// Componente per centrare e aprire un popup specifico
function MapController({ center, selectedId, places, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    
    // Use stable coordinate values
    const lat = center?.lat;
    const lng = center?.lng;
    
    if (selectedId && markerRefs.current[selectedId]) {
      const place = places.find(p => p.id === selectedId);
      if (place) {
        map.setView([place.lat, place.lng], 16, { animate: true });
        const marker = markerRefs.current[selectedId];
        if (marker && marker.openPopup) {
          marker.openPopup();
        }
      }
    } else if (lat != null && lng != null) {
      map.setView([lat, lng], 14, { animate: true });
    }
  }, [selectedId, map, places, center?.lat, center?.lng, markerRefs]);
  return null;
}

export default function MapViewer({ location, places = [], selectedPlaceId, setSelectedPlaceId }) {
  const markerRefs = useRef({});

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return <div style={{ color: 'white', padding: '20px' }}>In attesa della posizione...</div>;
  }

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '300px' }}>
      <MapContainer 
        center={[location.lat, location.lng]} 
        zoom={14} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Posizione Utente */}
        <Marker position={[location.lat, location.lng]} icon={getIconForCategory(null, true)}>
          <Popup>La tua posizione attuale</Popup>
        </Marker>

        {/* Luoghi sicuri */}
        {Array.isArray(places) && places.map((place) => (
          (place && place.lat != null && place.lng != null) ? (
            <Marker 
              key={place.id}
              position={[place.lat, place.lng]}
              icon={getIconForCategory(place.category)}
              ref={(ref) => { 
                if (ref) markerRefs.current[place.id] = ref; 
              }}
              eventHandlers={{
                click: () => {
                  if (setSelectedPlaceId) setSelectedPlaceId(place.id);
                }
              }}
            >
              <Popup>
                <div style={{ padding: '4px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#111' }}>{place.name}</h3>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#444' }}>
                    <strong>Categoria:</strong> {place.category}
                  </p>
                  {place.phone && (
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#444' }}>
                      <strong>Telefono:</strong> <a href={`tel:${place.phone}`}>{place.phone}</a>
                    </p>
                  )}
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#444' }}>
                    <strong>Orari:</strong> {place.opening_hours || 'Non disponibili'}
                  </p>
                </div>
              </Popup>
            </Marker>
          ) : null
        ))}

        <MapController 
          center={location} 
          selectedId={selectedPlaceId} 
          places={places} 
          markerRefs={markerRefs} 
        />

      </MapContainer>
    </div>
  );
}
