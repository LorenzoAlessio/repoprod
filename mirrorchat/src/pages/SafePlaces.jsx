import { useState, useEffect } from 'react';
import MapViewer, { getCategoryInfo } from '../components/MapViewer';
import SafePlacesChatbot from '../components/SafePlacesChatbot';
import styles from './SafePlaces.module.css';

export default function SafePlaces() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);

  const requestLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocalizzazione non supportata dal tuo browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          console.log('[SafePlaces] Geolocation success');
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          await fetchNearbyPlaces(coords);
          setLoading(false);
        } catch (innerErr) {
          console.error('[SafePlaces] Error in success callback:', innerErr);
          setError('Errore interno durante il caricamento dei dati.');
          setLoading(false);
        }
      },
      (err) => {
        let msg = 'Errore nel recupero della posizione.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Permesso negato. Clicca il pulsante sotto o abilita la geolocalizzazione nelle impostazioni del browser per riprovare.';
        }
        setError(msg);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fetchNearbyPlaces = async (coords) => {
    try {
      const response = await fetch(`/api/places/nearby?lat=${coords.lat}&lng=${coords.lng}`);
      if (!response.ok) throw new Error('Errore nel caricamento dei dati');
      const data = await response.json();
      setPlaces(data.places || []);
    } catch (err) {
      console.error('Failed to fetch nearby places', err);
    }
  };

  useEffect(() => {
    console.log('[SafePlaces] Initializing...');
    requestLocation();
  }, []);

  console.log('[SafePlaces] Render state:', { loading, error, hasLocation: !!location, placesCount: places.length });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Posti sicuri</h1>
        <p className={styles.subtitle}>Trova luoghi affidabili e ricevi aiuto immediato vicino a te.</p>
      </header>

      <div className={styles.content}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <span />
            <p>Ricerca della tua posizione...</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.errorOverlay}>
            <h3>Attenzione</h3>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={requestLocation}>
              Riprova ad autorizzare
            </button>
          </div>
        )}

        {!loading && !error && location && (
          <div style={{ display: 'flex', width: '100%', height: '100%', flex: 1 }}>
            <div className={styles.mapSection}>
              <div className={styles.mapWrapper}>
                <MapViewer 
                  location={location} 
                  places={places} 
                  selectedPlaceId={selectedPlaceId}
                  setSelectedPlaceId={setSelectedPlaceId}
                />
              </div>
              <div className={styles.legend}>
                {[
                  { key: 'pharmacy', label: 'Farmacia' },
                  { key: 'hospital', label: 'Ospedale' },
                  { key: 'police', label: 'Forze dell\'Ordine' },
                  { key: 'social_facility', label: 'Centro d\'Ascolto' },
                  { key: 'supermarket', label: 'Luogo Affollato' },
                ].map(({ key, label }) => {
                  const info = getCategoryInfo(key);
                  return (
                    <div key={key} className={styles.legendItem}>
                      <span className={styles.legendIcon} style={{ borderColor: info.color }}>
                        {info.icon}
                      </span>
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={styles.chatWrapper}>
              <SafePlacesChatbot 
                places={places} 
                onSelectPlace={(id) => setSelectedPlaceId(id)} 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
