/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { GameState, Station, RailwayLink, Train, Particle, CargoType } from '../game/types';
import { CARGO_METADATA } from '../game/station';
import { LOCOMOTIVE_COLORS } from '../game/train';
import { gameAudio } from '../game/audio';

interface GameCanvasProps {
  gameState: GameState;
  particles: Particle[];
  setParticles: React.Dispatch<React.SetStateAction<Particle[]>>;
  onUnlockStation: (stationId: string) => void;
  onBuildLink: (linkId: string) => void;
  selectedTrain: Train | null;
  onSelectStation: (station: Station | null) => void;
}

// Organic landscape decorations to render on the canvas background
const LANDSCAPE_TREES = [
  { x: 120, y: 150, r: 12 }, { x: 140, y: 160, r: 15 }, { x: 130, y: 180, r: 10 },
  { x: 880, y: 120, r: 18 }, { x: 910, y: 140, r: 14 },
  { x: 450, y: 180, r: 12 }, { x: 470, y: 190, r: 15 },
  { x: 520, y: 780, r: 16 }, { x: 500, y: 800, r: 12 },
  { x: 100, y: 550, r: 15 }, { x: 920, y: 580, r: 14 },
  { x: 650, y: 180, r: 12 }, { x: 320, y: 920, r: 16 }
];

const LANDSCAPE_MOUNTAINS = [
  { x: 400, y: 100, w: 120, h: 60 },
  { x: 620, y: 90, w: 90, h: 50 },
  { x: 900, y: 400, w: 80, h: 45 },
  { x: 80, y: 400, w: 70, h: 40 }
];

const LANDSCAPE_LAKES = [
  { x: 480, y: 320, rx: 60, ry: 30 },
  { x: 900, y: 880, rx: 70, ry: 40 }
];

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  particles,
  setParticles,
  onUnlockStation,
  onBuildLink,
  selectedTrain,
  onSelectStation
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [hoveredLink, setHoveredLink] = useState<RailwayLink | null>(null);

  // Resize listener using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Keep standard ratio if possible, but fluid scaling is fine
        setDimensions({
          width: width,
          height: Math.max(350, height)
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Map coordinates (0-1000) to actual canvas pixels
  const toCanvasCoords = (mapX: number, mapY: number) => {
    const scaleX = dimensions.width / 1000;
    const scaleY = dimensions.height / 1000;
    return {
      x: mapX * scaleX,
      y: mapY * scaleY
    };
  };

  // Canvas pixels back to map coordinates (0-1000)
  const toMapCoords = (canvasX: number, canvasY: number) => {
    const scaleX = 1000 / dimensions.width;
    const scaleY = 1000 / dimensions.height;
    return {
      x: canvasX * scaleX,
      y: canvasY * scaleY
    };
  };

  // Mouse interaction: Check hover on Stations and Links
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mapCoords = toMapCoords(mouseX, mouseY);

    // 1. Check Stations hover (Radius 35 pixels in map coords approx)
    let foundStation: Station | null = null;
    for (const station of gameState.stations) {
      const dx = station.x - mapCoords.x;
      const dy = station.y - mapCoords.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Hitbox is slightly larger for easier mobile/click interaction
      if (dist < 45) {
        foundStation = station;
        break;
      }
    }

    setHoveredStation(foundStation);

    // If hovering a station, clear link hover
    if (foundStation) {
      setHoveredLink(null);
      canvasRef.current.style.cursor = 'pointer';
      return;
    }

    // 2. Check unbuilt Links hover (distance to line segment)
    let foundLink: RailwayLink | null = null;
    for (const link of gameState.links) {
      // Find coordinates
      const fromSt = gameState.stations.find(s => s.id === link.from);
      const toSt = gameState.stations.find(s => s.id === link.to);
      if (!fromSt || !toSt) continue;

      // Distance from mouse to line segment
      const dist = distToSegment(mapCoords, fromSt, toSt);
      if (dist < 18) {
        foundLink = link;
        break;
      }
    }

    setHoveredLink(foundLink);
    if (foundLink) {
      canvasRef.current.style.cursor = 'pointer';
    } else {
      canvasRef.current.style.cursor = 'default';
    }
  };

  const handleMouseLeave = () => {
    setHoveredStation(null);
    setHoveredLink(null);
  };

  // Click on Canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredStation) {
      gameAudio.playClick();
      if (!hoveredStation.isUnlocked) {
        // Unlock station trigger
        onUnlockStation(hoveredStation.id);
      } else {
        // Select station in UI
        onSelectStation(hoveredStation);
      }
    } else if (hoveredLink) {
      gameAudio.playClick();
      if (!hoveredLink.isBuilt) {
        onBuildLink(hoveredLink.id);
      }
    } else {
      onSelectStation(null);
    }
  };

  // Helper: Distance from Point P to Line Segment AB
  const distToSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (a.x + t * (b.x - a.x))) ** 2 + (p.y - (a.y + t * (b.y - a.y))) ** 2);
  };

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and set sizes
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const isDark = gameState.isDarkMode;

    // 1. Draw Base Terrain & Grid (Forest/Grassland model railway aesthetic)
    ctx.fillStyle = isDark ? '#22301a' : '#f1f6ed'; 
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Grid dots overlay
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'; 
    const gridSpacing = 50;
    const gCoordsSpacingX = dimensions.width / 20;
    const gCoordsSpacingY = dimensions.height / 20;
    for (let i = 1; i < 20; i++) {
      for (let j = 1; j < 20; j++) {
        ctx.beginPath();
        ctx.arc(i * gCoordsSpacingX, j * gCoordsSpacingY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Draw Organic Decorations (Mountains, Lakes, Forests)
    // Draw Lakes
    LANDSCAPE_LAKES.forEach(lake => {
      const pos = toCanvasCoords(lake.x, lake.y);
      const scaleX = dimensions.width / 1000;
      const scaleY = dimensions.height / 1000;
      
      ctx.fillStyle = isDark ? '#1E293B' : '#E0F2FE'; // slate or light blue
      ctx.strokeStyle = isDark ? '#334155' : '#BAE6FD';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, lake.rx * scaleX, lake.ry * scaleY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw Mountains
    LANDSCAPE_MOUNTAINS.forEach(mountain => {
      const pos = toCanvasCoords(mountain.x, mountain.y);
      const scaleX = dimensions.width / 1000;
      const scaleY = dimensions.height / 1000;
      const w = mountain.w * scaleX;
      const h = mountain.h * scaleY;

      ctx.beginPath();
      ctx.moveTo(pos.x - w / 2, pos.y);
      ctx.lineTo(pos.x, pos.y - h);
      ctx.lineTo(pos.x + w / 2, pos.y);
      ctx.closePath();

      // Shadow side
      const grad = ctx.createLinearGradient(pos.x - w / 2, pos.y, pos.x + w / 2, pos.y);
      if (isDark) {
        grad.addColorStop(0, '#334155');
        grad.addColorStop(1, '#1E293B');
      } else {
        grad.addColorStop(0, '#E2E8F0');
        grad.addColorStop(1, '#CBD5E1');
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // Cap/snow on peaks
      ctx.beginPath();
      ctx.moveTo(pos.x - w * 0.15, pos.y - h * 0.7);
      ctx.lineTo(pos.x, pos.y - h);
      ctx.lineTo(pos.x + w * 0.15, pos.y - h * 0.7);
      ctx.lineTo(pos.x, pos.y - h * 0.6);
      ctx.closePath();
      ctx.fillStyle = isDark ? '#64748B' : '#F8FAFC';
      ctx.fill();
    });

    // Draw Forest Clusters (Trees)
    LANDSCAPE_TREES.forEach(tree => {
      const pos = toCanvasCoords(tree.x, tree.y);
      const scale = dimensions.width / 1000;
      const r = tree.r * scale;

      // Draw shadow
      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.ellipse(pos.x + r * 0.2, pos.y + r * 0.2, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trunk
      ctx.fillStyle = '#78350F'; // amber-900 brown
      ctx.fillRect(pos.x - r * 0.15, pos.y, r * 0.3, r * 0.8);

      // Leaves
      const leavesGrad = ctx.createRadialGradient(pos.x, pos.y - r * 0.2, r * 0.2, pos.x, pos.y, r);
      if (isDark) {
        leavesGrad.addColorStop(0, '#065F46'); // emerald 800
        leavesGrad.addColorStop(1, '#064E3B'); // emerald 900
      } else {
        leavesGrad.addColorStop(0, '#34D399'); // emerald 400
        leavesGrad.addColorStop(1, '#059669'); // emerald 600
      }
      ctx.fillStyle = leavesGrad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - r * 0.1, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. DRAW RAILWAY LINKS (TRENES VÍAS)
    gameState.links.forEach(link => {
      const fromSt = gameState.stations.find(s => s.id === link.from);
      const toSt = gameState.stations.find(s => s.id === link.to);
      if (!fromSt || !toSt) return;

      const p1 = toCanvasCoords(fromSt.x, fromSt.y);
      const p2 = toCanvasCoords(toSt.x, toSt.y);

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      const isHovered = hoveredLink?.id === link.id;

      if (link.isBuilt) {
        // Draw built railroad: sleepers and dual rails
        ctx.save();
        ctx.translate(p1.x, p1.y);
        ctx.rotate(angle);

        // Draw soft background track bed (ballast)
        ctx.strokeStyle = isDark ? '#1E293B' : '#E2E8F0';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(dist, 0);
        ctx.stroke();

        // DRAW SLEEPERS (short horizontal wooden ties)
        ctx.strokeStyle = isDark ? '#475569' : '#8B5A2B'; // brown wooden ties
        ctx.lineWidth = 2.5;
        const sleeperSpacing = 11; // px
        for (let d = 5; d < dist - 5; d += sleeperSpacing) {
          ctx.beginPath();
          ctx.moveTo(d, -5);
          ctx.lineTo(d, 5);
          ctx.stroke();
        }

        // DRAW TWO METALLIC RAILS
        ctx.strokeStyle = isDark ? '#CBD5E1' : '#64748B'; // Steel color
        ctx.lineWidth = 1.2;
        
        // Left rail
        ctx.beginPath();
        ctx.moveTo(0, -3.5);
        ctx.lineTo(dist, -3.5);
        ctx.stroke();

        // Right rail
        ctx.beginPath();
        ctx.moveTo(0, 3.5);
        ctx.lineTo(dist, 3.5);
        ctx.stroke();

        ctx.restore();
      } else {
        // Link is unbuilt: Draw dashed construction route
        const levelRequirementOk = gameState.level >= Math.max(fromSt.levelRequired, toSt.levelRequired);
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        if (isHovered && levelRequirementOk) {
          ctx.strokeStyle = '#10B981'; // Green hover
          ctx.lineWidth = 4;
          ctx.setLineDash([8, 5]);
        } else {
          ctx.strokeStyle = isDark ? 'rgba(71,85,105,0.4)' : 'rgba(148,163,184,0.5)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 6]);
        }
        ctx.stroke();
        ctx.restore();

        // If hovered and unbuilt, draw a quick price tag overlay on the center
        if (isHovered && levelRequirementOk) {
          const cx = p1.x + dx / 2;
          const cy = p1.y + dy / 2;
          ctx.fillStyle = '#10B981';
          ctx.fillRect(cx - 45, cy - 12, 90, 24);
          
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Construir: $${link.cost}`, cx, cy);
        }
      }
    });

    // 4. DRAW TRAINS (Lively locomotives and carriage chains)
    gameState.trains.forEach(train => {
      if (train.status === 'idle') return;

      const fromSt = gameState.stations.find(s => s.id === train.fromStationId);
      const toSt = gameState.stations.find(s => s.id === train.toStationId);
      if (!fromSt || !toSt) return;

      const p1 = toCanvasCoords(fromSt.x, fromSt.y);
      const p2 = toCanvasCoords(toSt.x, toSt.y);

      // Train rotation angle
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      // Train speed/position interpolation
      const trainProgress = train.progress;
      const trainX = p1.x + (p2.x - p1.x) * trainProgress;
      const trainY = p1.y + (p2.y - p1.y) * trainProgress;

      const isSelected = selectedTrain?.id === train.id;

      // Draw headlight beam (Cone of yellow light)
      if (isDark) {
        ctx.save();
        ctx.translate(trainX, trainY);
        ctx.rotate(angle);

        const beamLength = 80;
        const beamAngle = 0.25; // width of cone

        const headlightGrad = ctx.createRadialGradient(0, 0, 2, beamLength * 0.8, 0, beamLength);
        headlightGrad.addColorStop(0, 'rgba(253, 224, 71, 0.55)'); // bright gold
        headlightGrad.addColorStop(0.3, 'rgba(253, 224, 71, 0.2)');
        headlightGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');

        ctx.fillStyle = headlightGrad;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.arc(5, 0, beamLength, -beamAngle, beamAngle);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // DRAW THE VEHICLES (Locomotive followed by chain of carriages)
      // Carriages must stay behind. We compute positions along the route segment.
      const carriageSpacing = 0.045; // percentage of line spacing per carriage
      const carriageLengthInPx = 16;
      const carriageWidthInPx = 9;

      // 1. Draw carriages first so locomotive stays on top
      train.carriages.forEach((carriage, index) => {
        const carriageProgress = trainProgress - (index + 1) * carriageSpacing;
        if (carriageProgress < 0 || carriageProgress > 1) return; // don't draw if not yet on line

        const cX = p1.x + (p2.x - p1.x) * carriageProgress;
        const cY = p1.y + (p2.y - p1.y) * carriageProgress;

        ctx.save();
        ctx.translate(cX, cY);
        ctx.rotate(angle);

        // Connector link line
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-carriageLengthInPx / 2 - 2, 0);
        ctx.lineTo(carriageLengthInPx / 2 + 2, 0);
        ctx.stroke();

        // Draw carriage body
        const metadata = CARGO_METADATA[carriage.type];
        const bodyColor = metadata?.color || '#94A3B8';

        ctx.fillStyle = bodyColor;
        ctx.strokeStyle = isDark ? '#1E293B' : '#475569';
        ctx.lineWidth = 1.5;

        // Draw box
        ctx.beginPath();
        ctx.roundRect(-carriageLengthInPx / 2, -carriageWidthInPx / 2, carriageLengthInPx, carriageWidthInPx, 2);
        ctx.fill();
        ctx.stroke();

        // Customize interior based on cargo type
        if (carriage.type === CargoType.PASSENGER) {
          // Draw yellow passenger windows
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect(-carriageLengthInPx * 0.3, -2, 3, 1.2);
          ctx.fillRect(-carriageLengthInPx * 0.05, -2, 3, 1.2);
          ctx.fillRect(carriageLengthInPx * 0.2, -2, 3, 1.2);
          
          ctx.fillRect(-carriageLengthInPx * 0.3, 1.5, 3, 1.2);
          ctx.fillRect(-carriageLengthInPx * 0.05, 1.5, 3, 1.2);
          ctx.fillRect(carriageLengthInPx * 0.2, 1.5, 3, 1.2);
        } else if (carriage.type === CargoType.COAL && carriage.currentAmount > 0) {
          // Black coal pile
          ctx.fillStyle = '#1F2937';
          ctx.beginPath();
          ctx.arc(-2, 0, 3, 0, Math.PI * 2);
          ctx.arc(2, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (carriage.type === CargoType.WOOD && carriage.currentAmount > 0) {
          // Tree logs (brown lines)
          ctx.strokeStyle = '#78350F';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-carriageLengthInPx * 0.3, -1.5); ctx.lineTo(carriageLengthInPx * 0.3, -1.5);
          ctx.moveTo(-carriageLengthInPx * 0.35, 1.5); ctx.lineTo(carriageLengthInPx * 0.25, 1.5);
          ctx.stroke();
        } else if (carriage.type === CargoType.WHEAT && carriage.currentAmount > 0) {
          // Golden grain dome
          ctx.fillStyle = '#D97706';
          ctx.beginPath();
          ctx.ellipse(0, 0, carriageLengthInPx * 0.3, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (carriage.type === CargoType.STEEL && carriage.currentAmount > 0) {
          // Cross metallic bars
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-carriageLengthInPx * 0.25, -2); ctx.lineTo(carriageLengthInPx * 0.25, 2);
          ctx.moveTo(-carriageLengthInPx * 0.25, 2); ctx.lineTo(carriageLengthInPx * 0.25, -2);
          ctx.stroke();
        }

        // Load Indicator (tiny gauge / percentage bar)
        if (carriage.currentAmount > 0) {
          const loadPercent = carriage.currentAmount / carriage.capacity;
          ctx.fillStyle = '#10B981'; // Green
          ctx.fillRect(-carriageLengthInPx * 0.4, -carriageWidthInPx / 2 - 3, carriageLengthInPx * 0.8 * loadPercent, 1.5);
        }

        ctx.restore();
      });

      // 2. DRAW THE LOCOMOTIVE
      ctx.save();
      ctx.translate(trainX, trainY);
      ctx.rotate(angle);

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#10B981'; // pulsing glowing select
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Locomotive dimensions
      const locoLen = 24;
      const locoWidth = 11;

      // Color based on engine type
      const engineColor = LOCOMOTIVE_COLORS[train.locomotiveType] || LOCOMOTIVE_COLORS.steam;

      ctx.fillStyle = engineColor;
      ctx.strokeStyle = isDark ? '#1E293B' : '#334155';
      ctx.lineWidth = 1.8;

      // Draw steam or diesel engine chassis
      ctx.beginPath();
      ctx.roundRect(-locoLen / 2, -locoWidth / 2, locoLen, locoWidth, 2.5);
      ctx.fill();
      ctx.stroke();

      // Cab / Driver's window
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-locoLen / 2 + 1, -locoWidth / 2 + 1, 7, locoWidth - 2);
      ctx.fillStyle = '#FEF08A'; // window light
      ctx.fillRect(-locoLen / 2 + 3, -locoWidth / 2 + 2, 2.5, 1.5);
      ctx.fillRect(-locoLen / 2 + 3, locoWidth / 2 - 3.5, 2.5, 1.5);

      // Boiler details (Steam)
      if (train.locomotiveType === 'steam') {
        // Chimney / smokestack
        ctx.fillStyle = '#111827';
        ctx.fillRect(locoLen * 0.2, -3, 3, 6);
        // Golden dome ornament
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.arc(locoLen * 0.05, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (train.locomotiveType === 'diesel') {
        // Sleek grill lines
        ctx.strokeStyle = '#1F2937';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(locoLen * 0.2, -3); ctx.lineTo(locoLen * 0.4, -3);
        ctx.moveTo(locoLen * 0.2, 0); ctx.lineTo(locoLen * 0.4, 0);
        ctx.moveTo(locoLen * 0.2, 3); ctx.lineTo(locoLen * 0.4, 3);
        ctx.stroke();
      } else if (train.locomotiveType === 'electric') {
        // Pantograph (connector to overhead line wire) on the roof
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-2, -locoWidth / 2);
        ctx.lineTo(1, -locoWidth / 2 - 4);
        ctx.lineTo(5, -locoWidth / 2 - 4);
        ctx.lineTo(8, -locoWidth / 2);
        ctx.stroke();
      }

      // Yellow Headlight source
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(locoLen / 2 - 1, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // 5. DRAW STATIONS (Cities & Resource nodes)
    gameState.stations.forEach(station => {
      const isUnlocked = station.isUnlocked;
      const isHovered = hoveredStation?.id === station.id;
      const scale = dimensions.width / 1000;
      const pos = toCanvasCoords(station.x, station.y);
      const nodeRadius = (isUnlocked ? 20 : 18) * scale;

      // Unlocked glowing halo
      if (isUnlocked) {
        ctx.fillStyle = station.color + '22'; // 10% opacity
        ctx.beginPath();
        const pulse = 1 + Math.sin(Date.now() / 400) * 0.12;
        ctx.arc(pos.x, pos.y, nodeRadius * 1.8 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      // Base circle
      if (isUnlocked) {
        ctx.fillStyle = station.color;
        ctx.strokeStyle = isDark ? '#FFFFFF' : '#1E293B';
        ctx.lineWidth = isHovered ? 3 : 2;
      } else {
        ctx.fillStyle = '#475569'; // Slate dark gray for locked
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // INNER ICON (using text/emojis since we don't have SVGs/Images imported)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.round(11 * scale)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let icon = '🚉';
      if (station.id === 'centralia') icon = '🏙️';
      else if (station.id === 'carbonia') icon = '🪨';
      else if (station.id === 'silvia') icon = '🌲';
      else if (station.id === 'toledo') icon = '🌾';
      else if (station.id === 'zaragoza') icon = '🏭';

      ctx.fillText(icon, pos.x, pos.y);

      // LOCK OVERLAY FOR LOCKED STATIONS
      if (!isUnlocked) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('🔒', pos.x, pos.y);
      }

      // STATION NAME
      ctx.fillStyle = isDark ? '#F1F5F9' : '#0F172A';
      ctx.font = `bold ${Math.round(13 * scale)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(station.name, pos.x, pos.y - nodeRadius - 12);

      // LOCKED COST OVERLAY
      if (!isUnlocked) {
        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
        ctx.font = `9px Inter, sans-serif`;
        ctx.fillText(`Desbloquear: $${station.costToUnlock}`, pos.x, pos.y + nodeRadius + 12);
      }

      // STORAGE PILLS (Unlocked Stations: Passengers/Cargo amounts)
      if (isUnlocked) {
        let py = pos.y + nodeRadius + 14;
        const cargoKeys = Object.keys(station.cargoAmount) as CargoType[];
        
        let labelText = '';
        cargoKeys.forEach(cargoKey => {
          const amt = station.cargoAmount[cargoKey] || 0;
          if (amt > 0.1) {
            const meta = CARGO_METADATA[cargoKey];
            labelText += `${Math.round(amt)}${meta?.unit || ''} • `;
          }
        });

        if (labelText) {
          labelText = labelText.slice(0, -3); // remove trailing bullet
          
          // Draw small rounded pill background
          ctx.font = '9px Inter, sans-serif';
          const textWidth = ctx.measureText(labelText).width;
          
          ctx.fillStyle = isDark ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.9)';
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 1;
          
          ctx.beginPath();
          ctx.roundRect(pos.x - textWidth / 2 - 6, py - 6, textWidth + 12, 12, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isDark ? '#E2E8F0' : '#475569';
          ctx.textAlign = 'center';
          ctx.fillText(labelText, pos.x, py);
        }
      }
    });

    // 6. DRAW PARTICLES (Smoke puffs, spark sparkles, floating money texts)
    particles.forEach(p => {
      const canvasPos = toCanvasCoords(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = p.alpha;

      if (p.type === 'smoke') {
        // Smoke is drawn as expanding fuzzy circle
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } 
      else if (p.type === 'spark') {
        // Spark is a rotating little star or square
        ctx.fillStyle = p.color;
        ctx.fillRect(canvasPos.x - p.size / 2, canvasPos.y - p.size / 2, p.size, p.size);
      } 
      else if (p.type === 'text' && p.text) {
        // Floating text with dark drop shadow
        ctx.font = `bold ${p.size}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        
        ctx.fillStyle = '#000000';
        ctx.fillText(p.text, canvasPos.x + 1, canvasPos.y + 1);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, canvasPos.x, canvasPos.y);
      }

      ctx.restore();
    });

  }, [dimensions, gameState, hoveredStation, hoveredLink, particles, selectedTrain]);

  // Particle updates (runs locally at 60fps)
  useEffect(() => {
    let lastTime = performance.now();
    let animId: number;

    const updateParticles = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (particles.length > 0) {
        setParticles(prev => 
          prev
            .map(p => {
              const nextLife = p.life + dt;
              const percentLife = nextLife / p.maxLife;
              
              // Physics movement
              const nextX = p.x + p.vx * dt;
              const nextY = p.y + p.vy * dt;

              // Alpha fades
              let nextAlpha = p.alpha;
              let nextSize = p.size;
              
              if (p.type === 'smoke') {
                nextAlpha = 0.8 * (1 - percentLife);
                nextSize = p.size + dt * 12; // expand smoke
              } else if (p.type === 'spark') {
                nextAlpha = 1 - percentLife;
                nextSize = Math.max(0.5, p.size - dt * 2);
              } else if (p.type === 'text') {
                // Slower linear fade
                nextAlpha = 1 - percentLife;
              }

              return {
                ...p,
                x: nextX,
                y: nextY,
                life: nextLife,
                alpha: Math.max(0, nextAlpha),
                size: nextSize
              };
            })
            // Filter out dead particles
            .filter(p => p.life < p.maxLife && p.alpha > 0)
        );
      }

      animId = requestAnimationFrame(updateParticles);
    };

    animId = requestAnimationFrame(updateParticles);
    return () => cancelAnimationFrame(animId);
  }, [particles]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800"
      id="game-canvas-container"
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
        className="block touch-none"
        id="game-canvas-element"
      />
      
      {/* Help tooltip on top left */}
      <div className="absolute top-4 left-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 pointer-events-none flex items-center gap-1.5 border border-slate-200/50 dark:border-slate-800/50">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        Haz clic en estaciones o vías punteadas para interactuar
      </div>
    </div>
  );
};
