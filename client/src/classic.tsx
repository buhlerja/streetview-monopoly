import { useState, useEffect } from 'react';
import './App.css';

type ClassicProps = {
  onExit?: () => void;
};

export default function Classic({ onExit }: ClassicProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleExit = () => {
    const mapDiv = document.getElementById("map");
    if (mapDiv) {
      mapDiv.innerHTML = "";
    }
    onExit?.();
  };


  useEffect(() => {
    const apiKey = import.meta.env.VITE_API_KEY;

    // Check if the Google Maps script is already added
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );

    const initializeMap = () => {
      if (!(window.google && window.google.maps)) return;

      // U of T (St. George campus) — roughly King's College Circle area
      const uoftCenter = { lat: 43.6629, lng: -79.3957 };

      const mapElement = document.getElementById("map");

      if (!mapElement) {
        console.error("Map element not found");
        return;
      }

      const map = new window.google.maps.Map(mapElement, {
        center: uoftCenter,
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      // Highlight a section of St. George St (approx segment: Bloor -> College)
      // You can tweak these points to match the exact section you want.
      const stGeorgeSegment = [
        { lat: 43.6676, lng: -79.3997 }, // near Bloor & St George (approx)
        { lat: 43.6586, lng: -79.396 }, // heading toward College (approx)
      ];

      const bloorSegment = [
        { lat: 43.6676, lng: -79.3997 }, // near Bloor & St George (approx)
        { lat: 43.6706, lng: -79.3865 }, // near yonge and bloor 43.6706° N, 79.3865° W
      ];

      const collegeSegment = [
        { lat: 43.6586, lng: -79.396 }, // heading toward College (approx), 
        { lat: 43.6613, lng: -79.3831 }, // yonge and college
      ];

      const yongeSegment = [
        { lat: 43.6706, lng: -79.3865 }, // near yonge and bloor 43.6706° N, 79.3865° W,
        { lat: 43.6613, lng: -79.3831 }, // yonge and college
      ];

      const polylineGeorge = new window.google.maps.Polyline({
        path: stGeorgeSegment,
        geodesic: true,
        strokeOpacity: 0.9,
        strokeWeight: 8,
        strokeColor: "#FF3B30", // iOS-ish red highlight
      });
      const polylineBloor = new window.google.maps.Polyline({
        path: bloorSegment,
        geodesic: true,
        strokeOpacity: 0.9,
        strokeWeight: 8,
        strokeColor: "#FF3B30", // iOS-ish red highlight
      });
      const polylineCollege = new window.google.maps.Polyline({
        path: collegeSegment,
        geodesic: true,
        strokeOpacity: 0.9,
        strokeWeight: 8,
        strokeColor: "#FF3B30", // iOS-ish red highlight
      });
      const polylineYonge = new window.google.maps.Polyline({
        path: yongeSegment,
        geodesic: true,
        strokeOpacity: 0.9,
        strokeWeight: 8,
        strokeColor: "#FF3B30", // iOS-ish red highlight
      });

      polylineGeorge.setMap(map);
      polylineBloor.setMap(map);
      polylineCollege.setMap(map);
      polylineYonge.setMap(map);

      // Fit view to the highlighted segment (so it's always visible)
      const bounds = new window.google.maps.LatLngBounds();
      stGeorgeSegment.forEach((point) => bounds.extend(point));
      bloorSegment.forEach((point) => bounds.extend(point));
      collegeSegment.forEach((point) => bounds.extend(point));
      yongeSegment.forEach((point) => bounds.extend(point));

      // Board tiles
      const tiles = [
        {
          id: "tgh",
          name: "Toronto General Hospital",
          position: { lat: 43.6581, lng: -79.3880 },
          price: 350,
          color: "#FFCC00",
        },
        {
          id: "bahen",
          name: "Bahen Centre",
          position: { lat: 43.6597, lng: -79.3974 },
          price: 300,
          color: "#34C759",
        },
        {
          id: "rom",
          name: "ROM",
          position: { lat: 43.6677, lng: -79.3949 },
          price: 400,
          color: "#0A84FF",
        },
      ];

      const info = new window.google.maps.InfoWindow();

      tiles.forEach((t) => {
        // marker
        const marker = new window.google.maps.Marker({
          position: t.position,
          map,
          title: t.name,
        });

        // “tile” circle overlay (clickable board space)
        const tileCircle = new window.google.maps.Circle({
          map,
          center: t.position,
          radius: 70, // meters (adjust: 40–120)
          fillColor: t.color,
          strokeColor: t.color,
          fillOpacity: 0.22,
          strokeOpacity: 0.95,
          strokeWeight: 3,
          clickable: true,
        });

        const openTile = () => {
          info.setContent(`
            <div style="min-width:180px">
              <div style="font-weight:700; margin-bottom:6px">${t.name}</div>
              <div>Price: $${t.price}</div>
              <div style="opacity:0.7; margin-top:6px; font-size:12px">
                (${t.position.lat.toFixed(5)}, ${t.position.lng.toFixed(5)})
              </div>
            </div>
          `);
          info.open({ map, anchor: marker });
        };

        marker.addListener("click", openTile);
        tileCircle.addListener("click", openTile);

        // nice hover feedback
        const hoverOn = () => tileCircle.setOptions({ fillOpacity: 0.35 });
        const hoverOff = () => tileCircle.setOptions({ fillOpacity: 0.22 });

        marker.addListener("mouseover", hoverOn);
        marker.addListener("mouseout", hoverOff);
        tileCircle.addListener("mouseover", hoverOn);
        tileCircle.addListener("mouseout", hoverOff);
      });


      map.fitBounds(bounds, 100); // 100px padding
    };


    if (!existingScript) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        initializeMap();
      };
    } else {
      // Script exists: check if maps is ready, otherwise wait
      if (window.google && window.google.maps) {
        initializeMap();
      } else {
        existingScript.addEventListener('load', initializeMap);
      }
    }
  }, []);


  return (
    <div className="app-container">

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? "Collapse" : "Expand"}
        </button>

        {sidebarOpen && (
          <div className="sidebar-buttons">
            <button>Roll Dice</button>
            <button>Buy Property</button>
            <button onClick={handleExit}>Exit</button>
          </div>
        )}
      </div>

      {/* Map area */}
      <div className="map-area">
        {/* Actual Google Map container */}
        <div
          id="map"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "12px"
          }}
        />
      </div>
    </div>
  );
}
