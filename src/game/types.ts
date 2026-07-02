/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum CargoType {
  PASSENGER = 'PASSENGER',
  COAL = 'COAL',
  WOOD = 'WOOD',
  WHEAT = 'WHEAT',
  STEEL = 'STEEL'
}

export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'city' | 'resource';
  produces: CargoType[];
  consumes: CargoType[];
  levelRequired: number;
  costToUnlock: number;
  isUnlocked: boolean;
  cargoAmount: { [key in CargoType]?: number };
  cargoMax: number;
  icon: string; // Emoji or Lucide name
  color: string;
}

export interface RailwayLink {
  id: string;
  from: string; // Station ID
  to: string;   // Station ID
  distance: number;
  cost: number;
  isBuilt: boolean;
}

export interface Carriage {
  id: string;
  type: CargoType;
  capacity: number;
  currentAmount: number;
}

export interface Train {
  id: string;
  name: string;
  locomotiveType: 'steam' | 'diesel' | 'electric';
  speedMultiplier: number;
  capacityMultiplier: number;
  fuelEfficiency: number; // 0.5 to 1.5 (lower is better, meaning less fuel cost)
  carriages: Carriage[];
  currentRoute: string[]; // List of Station IDs (e.g., ['stationA', 'stationB'])
  currentRouteIndex: number;
  progress: number; // 0 to 1 between stations
  direction: number; // 1 = forward along route, -1 = backward or waiting
  status: 'moving' | 'loading' | 'idle';
  loadingTimer: number; // in seconds
  fromStationId: string;
  toStationId: string;
  maxCarriages: number;
  color: string;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  cost: number;
  multiplier: number;
  category: 'speed' | 'capacity' | 'fuel';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'smoke' | 'spark' | 'money' | 'text';
  text?: string;
}

export interface GameStats {
  totalEarned: number;
  totalPassengersTransported: number;
  totalCargoTransported: number;
  earningsHistory: number[]; // Last 60 seconds of ticks to calculate EPM
  lastEPM: number;
}

export interface GameState {
  money: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  stations: Station[];
  links: RailwayLink[];
  trains: Train[];
  upgrades: Upgrade[];
  stats: GameStats;
  isDarkMode: boolean;
  volume: number;
  isFullscreen: boolean;
}
