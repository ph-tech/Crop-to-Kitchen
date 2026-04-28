import React, { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Globe } from 'lucide-react';
import { motion } from 'motion/react';

interface Point {
  lat: number;
  lng: number;
  label?: string;
}

interface MapComponentProps {
  markers: Point[];
  center?: Point;
  drawRoute?: boolean;
}

const MOCK_MARKERS: Point[] = [
  { lat: 13.7563, lng: 100.5018, label: "Farmer A: Rice" },
  { lat: 13.7263, lng: 100.5318, label: "Farmer B: Mango" },
  { lat: 13.7863, lng: 100.4818, label: "Farmer C: Corn" },
  { lat: 13.7367, lng: 100.5231, label: "Central Hub" }
];

export default function MapComponent({ markers, center, drawRoute = true }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    
    if (!apiKey) {
      setIsLoaded(true); // Allow rendering placeholder UI
      return;
    }

    setOptions({
      key: apiKey,
      v: "weekly"
    });

    // Pre-load essential libraries
    Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('routes'),
      importLibrary('geometry')
    ]).then(() => {
      setIsLoaded(true);
    }).catch(err => {
      console.error("Failed to load Google Maps libraries:", err);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    if (!apiKey || !window.google) return;

    const google = window.google;
    
    // Calculate average center if none provided
    const defaultCenter = { lat: 18.5204, lng: 73.8567 };
    let mapCenter = center;
    if (!mapCenter && markers.length > 0) {
      const avgLat = markers.reduce((acc, m) => acc + m.lat, 0) / markers.length;
      const avgLng = markers.reduce((acc, m) => acc + m.lng, 0) / markers.length;
      mapCenter = { lat: avgLat, lng: avgLng };
    } else if (!mapCenter) {
      mapCenter = defaultCenter;
    }

    const map = new google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 12,
      mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement
      styles: [
        {
          "featureType": "all",
          "elementType": "labels.text.fill",
          "stylers": [{"color": "#7c93a3"}]
        },
        {
          "featureType": "water",
          "elementType": "geometry",
          "stylers": [{"color": "#e2e8f0"}]
        }
      ],
      disableDefaultUI: true,
      zoomControl: true,
    });

    const bounds = new google.maps.LatLngBounds();

    markers.forEach((point, i) => {
      const position = new google.maps.LatLng(point.lat, point.lng);
      
      // Custom Marker
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position,
        map,
        title: point.label,
        content: (() => {
          const div = document.createElement('div');
          div.className = `p-2 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold text-[10px] w-8 h-8 ${i === markers.length - 1 ? 'bg-slate-900 text-white' : 'bg-primary text-white'}`;
          div.innerHTML = (i + 1).toString();
          return div;
        })()
      });

      bounds.extend(position);
    });

    if (markers.length > 1) {
      map.fitBounds(bounds);
    }

    if (drawRoute && markers.length > 1 && apiKey) {
      const calculateRoutesV2 = async () => {
        const origin = markers[0];
        const destination = markers[markers.length - 1];
        const intermediates = markers.slice(1, -1);

        const body = {
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
          intermediates: intermediates.map(p => ({
            location: { latLng: { latitude: p.lat, longitude: p.lng } }
          })),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          optimizeWaypointOrder: true
        };

        try {
          const [{ encoding }] = await Promise.all([
            google.maps.importLibrary('geometry') as Promise<google.maps.GeometryLibrary>
          ]);

          const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex'
            },
            body: JSON.stringify(body)
          });

          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const encodedPolyline = data.routes[0].polyline.encodedPolyline;
            const path = encoding.decodePath(encodedPolyline);

            new google.maps.Polyline({
              path,
              map,
              strokeColor: "#10b981",
              strokeWeight: 6,
              strokeOpacity: 0.8,
              icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
                offset: '100%',
                repeat: '100px'
              }]
            });
          }
        } catch (error) {
          console.error("Routes API v2 Error:", error);
        }
      };

      calculateRoutesV2();
    }
  }, [isLoaded, markers, center, drawRoute]);

  return (
    <div className="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border border-zinc-200/50 bg-zinc-50 relative group">
      <div ref={mapRef} className="w-full h-full bg-zinc-100" />
      
      {markers.length > 0 && !window.google && (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          {markers.map((m, i) => (
             <div key={i} className="bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-sm border border-zinc-100 flex items-center gap-2">
                <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[8px] text-white font-bold">{i+1}</div>
                <span className="text-[10px] font-bold text-slate-600">{m.label || 'Pickup'}</span>
             </div>
          ))}
        </div>
      )}

      {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-12 text-center overflow-hidden">
          {/* Tactical Grid Background */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#ffffff05 1px, transparent 1px), linear-gradient(90deg, #ffffff05 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at center, #10b98110 0%, transparent 70%)' }} />
          </div>

          <div className="absolute top-10 left-10 text-left space-y-2 opacity-40">
             <p className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Telemetry Streaming</p>
             <div className="w-32 h-[1px] bg-primary/20" />
             <p className="text-[8px] font-mono text-white/40 tracking-tighter italic">LAT: 18.5204 / LNG: 73.8567</p>
          </div>

          <div className="absolute bottom-10 right-10 text-right space-y-2 opacity-40">
             <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em]">Protocol: AIS/7A</p>
             <div className="w-32 h-[1px] bg-white/10 ml-auto" />
             <p className="text-[8px] font-mono text-white/40 tracking-tighter italic">Nodes: {markers.length} Verified</p>
          </div>

          {/* Animated Scanning Ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-[500px] h-[500px] border border-white/5 rounded-full border-t-primary/20"
            />
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="w-[400px] h-[400px] border border-white/5 rounded-full border-b-primary/10"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white/10 max-w-sm space-y-6 relative z-10">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto border border-primary/20 shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)]">
              <Globe size={40} className="animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Logistics Core</h3>
              <div className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest leading-relaxed">
                  Active & Synced
                </p>
              </div>
            </div>

            <p className="text-[11px] text-white/40 font-bold uppercase tracking-widest leading-relaxed px-4">
              Real-time spatial visualization is encrypted. Set your VITE_GOOGLE_MAPS_API_KEY to decrypt satellite feeds.
            </p>

            <div className="pt-4 grid grid-cols-2 gap-3">
               <div className="px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Live Nodes</span>
                  <span className="text-sm font-black text-white">{markers.length}</span>
               </div>
               <div className="px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Status</span>
                  <span className="text-[10px] font-black text-primary uppercase">Secure</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
