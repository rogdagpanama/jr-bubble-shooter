/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RailwayLink, Upgrade, Train, CargoType, Station } from './types';
import { CARGO_METADATA } from './station';

// Pre-defined links between stations
export const INITIAL_LINKS: RailwayLink[] = [
  {
    id: 'centralia-carbonia',
    from: 'centralia',
    to: 'carbonia',
    distance: 380,
    cost: 0,
    isBuilt: true // Built by default so the player can play right away
  },
  {
    id: 'centralia-silvia',
    from: 'centralia',
    to: 'silvia',
    distance: 350,
    cost: 0,
    isBuilt: true // Built by default
  },
  {
    id: 'centralia-toledo',
    from: 'centralia',
    to: 'toledo',
    distance: 350,
    cost: 400,
    isBuilt: false
  },
  {
    id: 'centralia-zaragoza',
    from: 'centralia',
    to: 'zaragoza',
    distance: 350,
    cost: 1000,
    isBuilt: false
  },
  {
    id: 'silvia-toledo',
    from: 'silvia',
    to: 'toledo',
    distance: 470,
    cost: 800,
    isBuilt: false
  },
  {
    id: 'carbonia-zaragoza',
    from: 'carbonia',
    to: 'zaragoza',
    distance: 470,
    cost: 800,
    isBuilt: false
  },
  {
    id: 'toledo-zaragoza',
    from: 'toledo',
    to: 'zaragoza',
    distance: 500,
    cost: 1500,
    isBuilt: false
  }
];

// Definition of standard upgrades
export const INITIAL_UPGRADES: Upgrade[] = [
  {
    id: 'speed',
    name: 'Motores de Alta Velocidad',
    description: 'Aumenta la velocidad de desplazamiento de todas las locomotoras.',
    level: 1,
    maxLevel: 5,
    cost: 250,
    multiplier: 1.0,
    category: 'speed'
  },
  {
    id: 'capacity',
    name: 'Vagones de Gran Capacidad',
    description: 'Aumenta el límite de carga y pasajeros por cada vagón.',
    level: 1,
    maxLevel: 5,
    cost: 200,
    multiplier: 1.0,
    category: 'capacity'
  },
  {
    id: 'fuel',
    name: 'Eficiencia de Combustible',
    description: 'Reduce el costo de mantenimiento y combustible de los viajes.',
    level: 1,
    maxLevel: 5,
    cost: 150,
    multiplier: 1.0,
    category: 'fuel'
  }
];

// Helper to get upgrade multiplier based on category and level
export function getUpgradeMultiplier(category: 'speed' | 'capacity' | 'fuel', level: number): number {
  if (category === 'speed') {
    // 1.0x, 1.25x, 1.55x, 1.9x, 2.3x speed
    return 1 + (level - 1) * 0.3;
  } else if (category === 'capacity') {
    // Capacity per carriage: 5, 8, 12, 18, 25 cargo units
    const capacities = [5, 10, 16, 24, 35];
    return capacities[Math.min(level - 1, 4)];
  } else {
    // Fuel multiplier: 1.0, 0.8, 0.6, 0.4, 0.2 (cost reductions)
    return Math.max(0.2, 1 - (level - 1) * 0.2);
  }
}

// Helper to calculate upgrade costs dynamically
export function getUpgradeCost(category: 'speed' | 'capacity' | 'fuel', currentLevel: number): number {
  const baseCosts = {
    speed: [250, 600, 1200, 2500, 0],
    capacity: [200, 500, 1100, 2200, 0],
    fuel: [150, 400, 850, 1800, 0]
  };
  return baseCosts[category][Math.min(currentLevel - 1, 4)];
}

// Locomotive pricing based on quantity owned
export function getLocomotiveCost(count: number): number {
  // Comienza en 350, luego sube
  const costs = [0, 400, 800, 1500, 3000, 6000, 12000];
  return costs[Math.min(count, costs.length - 1)];
}

// Carriage pricing
export const CARRIAGE_COST = 150;

/**
 * Calculates earnings for transporting a cargo from one station to another.
 * Generates more revenue for longer distances and heavy cargoes.
 */
export function calculateEarnings(
  cargoType: CargoType,
  amount: number,
  fromStation: Station,
  toStation: Station
): number {
  // Pythagoras distance
  const dx = fromStation.x - toStation.x;
  const dy = fromStation.y - toStation.y;
  const pixelDistance = Math.sqrt(dx * dx + dy * dy);
  
  // Base cargo unit value
  const baseVal = CARGO_METADATA[cargoType]?.value || 10;
  
  // Formula: CargoAmount * BaseValue * (DistanceFactor)
  // Distance factor scales linearly with pixel distance (divided by a reference of 250 pixels)
  const distanceFactor = Math.max(0.5, pixelDistance / 250);
  
  // Total profit
  const profit = Math.round(amount * baseVal * distanceFactor);
  return profit;
}

/**
 * Calculates the operational cost of running a train (maintenance) per frame tick
 */
export function getMaintenanceCost(train: Train, fuelUpgradeLevel: number, timeDelta: number): number {
  const baseCost = 2.0; // $2 per second base cost
  const fuelMultiplier = getUpgradeMultiplier('fuel', fuelUpgradeLevel);
  const trainSizeFactor = 1 + train.carriages.length * 0.2; // heavier trains cost more
  
  return baseCost * fuelMultiplier * trainSizeFactor * timeDelta;
}
