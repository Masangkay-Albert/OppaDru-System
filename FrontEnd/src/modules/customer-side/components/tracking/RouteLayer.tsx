import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getRouteOSRM, getRouteFromGoogle } from '../../../../services/geocodingService';

interface RouteLayerProps {
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  progress: number;
  onRouteLoaded?: (routePoints: [number, number][]) => void;
}

const RouteLayer: React.FC<RouteLayerProps> = ({ start, end, progress, onRouteLoaded }) => {
  const [fullRoute, setFullRoute] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const map = useMap();
  const onRouteLoadedRef = useRef(onRouteLoaded);

  useEffect(() => {
    onRouteLoadedRef.current = onRouteLoaded;
  }, [onRouteLoaded]);

  useEffect(() => {
    let isCancelled = false;

    const fetchRoute = async () => {
      setLoading(true);
      setUsingFallback(false);

      let points = await getRouteOSRM(
        { lat: start.lat, lng: start.lng },
        { lat: end.lat, lng: end.lng }
      );

      if (!points || points.length === 0) {
        points = await getRouteFromGoogle(
          { lat: start.lat, lng: start.lng },
          { lat: end.lat, lng: end.lng }
        );
      }

      if (isCancelled) return;

      if (points && points.length > 0) {
        setFullRoute(points);
        onRouteLoadedRef.current?.(points);
        map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
      } else {
        const fallbackPoints: [number, number][] = [
          [start.lat, start.lng],
          [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2],
          [end.lat, end.lng]
        ];
        setFullRoute(fallbackPoints);
        onRouteLoadedRef.current?.(fallbackPoints);
        setUsingFallback(true);
      }
      setLoading(false);
    };
    fetchRoute();

    return () => {
      isCancelled = true;
    };
  }, [start.lat, start.lng, end.lat, end.lng, map]);

  const traveledRoute = useMemo(() => {
    if (!fullRoute.length) return [];
    const count = Math.floor((progress / 100) * fullRoute.length);
    return fullRoute.slice(0, Math.max(1, count + 1));
  }, [fullRoute, progress]);

  const remainingRoute = useMemo(() => {
    if (!fullRoute.length) return [];
    const count = Math.floor((progress / 100) * fullRoute.length);
    return fullRoute.slice(Math.max(1, count));
  }, [fullRoute, progress]);

  if (loading) {
    return (
      <div className="absolute top-2 left-2 z-[1000] bg-white/90 p-2 rounded shadow text-xs">
        Loading route...
      </div>
    );
  }

  if (!fullRoute.length) {
    return (
      <div className="absolute top-2 left-2 z-[1000] bg-red-100 p-2 rounded shadow text-xs text-red-600">
        No route available
      </div>
    );
  }

  return (
    <>
      {usingFallback && (
        <div className="absolute top-2 left-2 z-[1000] bg-yellow-100 p-2 rounded shadow text-xs text-yellow-700">
          Using straight-line route
        </div>
      )}
      {remainingRoute.length > 1 && (
        <Polyline positions={remainingRoute} color="#e76f51" weight={4} opacity={0.7} dashArray="8, 8" />
      )}
      {traveledRoute.length > 1 && (
        <Polyline positions={traveledRoute} color="#2d6a4f" weight={4} opacity={0.9} />
      )}
    </>
  );
};

export default RouteLayer;