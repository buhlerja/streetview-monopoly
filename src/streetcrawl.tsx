import { useState, useEffect, useRef } from "react";
import "./App.css";

type StreetcrawlProps = {
  onExit?: () => void;
};

export default function Streetcrawl({ onExit }: StreetcrawlProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const mapRef = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const initializedRef = useRef(false);

    const enterStreetView = () => {
        const map = mapRef.current;
        const marker = markerRef.current;

        if (!map || !marker) return;
        if (!(window.google && window.google.maps)) return;

        const targetPos = marker.getPosition();
        if (!targetPos) return;

        const streetViewService = new window.google.maps.StreetViewService();

        streetViewService.getPanorama(
            { location: targetPos, radius: 100 },
            (data: google.maps.StreetViewPanoramaData | null, status: google.maps.StreetViewStatus) => {
                if (status !== google.maps.StreetViewStatus.OK || !data?.location?.pano) {
                    console.warn("No Street View available near marker");
                    return;
                }

                const panorama = map.getStreetView();

                panorama.setOptions({
                    clickToGo: true,
                    linksControl: true,
                    panControl: true,
                    zoomControl: true,
                    addressControl: false,
                    fullscreenControl: false,
                });

                panorama.setPano(data.location.pano);
                panorama.setPov({
                    heading: 0, 
                    pitch: 0,
                });

                panorama.setVisible(true);
            }
        );
    };

    const handleExit = () => {
        onExit?.();
    };

    useEffect(() => {
        const apiKey = import.meta.env.VITE_API_KEY;

        const existingScript = document.querySelector(
            'script[src*="maps.googleapis.com/maps/api/js"]'
        );

        const initializeMap = () => {
            if (initializedRef.current) return;
            initializedRef.current = true;
            if (!(window.google && window.google.maps)) return;

            const uoftCenter = { lat: 43.6629, lng: -79.3957 };
            const bloorAndYonge = { lat: 43.6706, lng: -79.3865 };

            const map = new window.google.maps.Map(document.getElementById("map"), {
                center: uoftCenter,
                zoom: 16,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
            });

            const marker = new window.google.maps.Marker({
                position: bloorAndYonge,
                map,
                title: "Bloor & Yonge",
            });

            mapRef.current = map;
            markerRef.current = marker;
         };

        if (!existingScript) {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.onload = initializeMap;
            script.onerror = () => console.error("Failed to load Google Maps script");
            document.body.appendChild(script);
        } else {
            if (window.google && window.google.maps) {
                initializeMap();
            } else {
                existingScript.addEventListener("load", initializeMap);
            }
        }

        return () => {
            if (mapRef.current) {
            const pano = mapRef.current.getStreetView();
            pano.setVisible(false);
            window.google?.maps?.event?.clearInstanceListeners(pano);
            window.google?.maps?.event?.clearInstanceListeners(mapRef.current);
            }
            if (markerRef.current) {
            window.google?.maps?.event?.clearInstanceListeners(markerRef.current);
            }
            mapRef.current = null;
            markerRef.current = null;
        };
    }, []);

    return (
        <div className="app-container">
        <div className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
            <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? "Collapse" : "Expand"}
            </button>

            {sidebarOpen && (
            <div className="sidebar-buttons">
                <button>Roll Dice</button>
                <button>Buy Property</button>
                <button type="button" onClick={handleExit}>Exit</button>
                <button type="button" onClick={enterStreetView}>Enter Street View</button>
            </div>
            )}
        </div>

        <div className="map-area">
            <div
            id="map"
            style={{ width: "100%", height: "100%", borderRadius: "12px" }}
            />
        </div>
        </div>
    );
}
