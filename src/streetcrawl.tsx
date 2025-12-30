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

    // State to store the path a user takes in Street View
    const streetViewPath = useRef<google.maps.LatLngLiteral[]>([]);

    const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);

    const enterStreetView = (): void => {
        const map = mapRef.current;
        const marker = markerRef.current;

        if (!map || !marker || !window.google?.maps) return;

        const position = marker.getPosition();
        if (!position) return;

        // Create panorama ONCE
        if (!panoramaRef.current) {
            panoramaRef.current = new google.maps.StreetViewPanorama(
            map.getDiv(),
            {
                pov: { heading: 0, pitch: 0 },
                visible: false,
                clickToGo: true,     // <-- enables moving
                linksControl: true,  // <-- shows arrows
                panControl: true,
                zoomControl: true,
                addressControl: false,
                fullscreenControl: false,
            }
            );

            map.setStreetView(panoramaRef.current);
        }

        // Track user movement while in streetview
        panoramaRef.current.addListener("position_changed", () => {
            const newPos = panoramaRef.current!.getPosition();
            if (newPos) {
                streetViewPath.current.push({ lat: newPos.lat(), lng: newPos.lng() });
            }
        });

        // Enter Street View at marker location
        panoramaRef.current.setPosition(position);
        panoramaRef.current.setVisible(true);
    };

    const handleExit = () => {
        onExit?.();
    };

    const handleStreetViewClose = () => {
        const map = mapRef.current;
        if (!map || !panoramaRef.current) return;

        panoramaRef.current.setVisible(false);

        // Draw the path on the map
        new google.maps.Polyline({
            map,
            path: streetViewPath.current,
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 4,
        });

        // Clear the path for next session
        // streetViewPath.current = [];
    }

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

            /*const marker = new window.google.maps.Marker({
                position: bloorAndYonge,
                map,
                title: "Bloor & Yonge",
            });*/

            const marker = new window.google.maps.Marker({
                position: { lat: 43.6603, lng: -79.3839 },
                map,
                title: "Yonge and College",
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
                <button type="button" onClick={handleExit}>Main Menu</button>
                <button type="button" onClick={enterStreetView}>Enter Street View</button>
                <button type="button" onClick={handleStreetViewClose}>Exit Street View</button>
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
