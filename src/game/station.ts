/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Station, CargoType } from './types';

export const INITIAL_STATIONS: Station[] = [
  {
    id: 'centralia',
    name: 'Estación Centralia',
    x: 500,
    y: 500,
    type: 'city',
    produces: [CargoType.PASSENGER],
    consumes: [CargoType.COAL, CargoType.WOOD, CargoType.WHEAT, CargoType.STEEL],
    levelRequired: 1,
    costToUnlock: 0,
    isUnlocked: true,
    cargoAmount: {
      [CargoType.PASSENGER]: 5,
      [CargoType.COAL]: 0,
      [CargoType.WOOD]: 0,
      [CargoType.WHEAT]: 0,
      [CargoType.STEEL]: 0
    },
    cargoMax: 50,
    icon: 'city',
    color: '#3B82F6' // Blue
  },
  {
    id: 'carbonia',
    name: 'Mina de Carbón',
    x: 780,
    y: 280,
    type: 'resource',
    produces: [CargoType.COAL],
    consumes: [],
    levelRequired: 1,
    costToUnlock: 0,
    isUnlocked: true,
    cargoAmount: {
      [CargoType.COAL]: 10
    },
    cargoMax: 40,
    icon: 'flame',
    color: '#4B5563' // Dark Grey
  },
  {
    id: 'silvia',
    name: 'Bosque Maderero',
    x: 220,
    y: 280,
    type: 'resource',
    produces: [CargoType.WOOD],
    consumes: [],
    levelRequired: 1,
    costToUnlock: 0,
    isUnlocked: true,
    cargoAmount: {
      [CargoType.WOOD]: 10
    },
    cargoMax: 40,
    icon: 'tree',
    color: '#10B981' // Green
  },
  {
    id: 'toledo',
    name: 'Ciudad Toledo',
    x: 250,
    y: 750,
    type: 'city',
    produces: [CargoType.PASSENGER, CargoType.WHEAT],
    consumes: [CargoType.WOOD, CargoType.STEEL],
    levelRequired: 2,
    costToUnlock: 1200,
    isUnlocked: false,
    cargoAmount: {
      [CargoType.PASSENGER]: 0,
      [CargoType.WHEAT]: 0,
      [CargoType.WOOD]: 0,
      [CargoType.STEEL]: 0
    },
    cargoMax: 60,
    icon: 'city-alt',
    color: '#F59E0B' // Orange
  },
  {
    id: 'zaragoza',
    name: 'Ciudad Zaragoza',
    x: 750,
    y: 750,
    type: 'city',
    produces: [CargoType.PASSENGER, CargoType.STEEL],
    consumes: [CargoType.COAL, CargoType.WHEAT],
    levelRequired: 3,
    costToUnlock: 3500,
    isUnlocked: false,
    cargoAmount: {
      [CargoType.PASSENGER]: 0,
      [CargoType.STEEL]: 0,
      [CargoType.COAL]: 0,
      [CargoType.WHEAT]: 0
    },
    cargoMax: 80,
    icon: 'factory',
    color: '#EF4444' // Red
  }
];

export const CARGO_METADATA = {
  [CargoType.PASSENGER]: {
    name: 'Pasajeros',
    value: 12, // Base value per tick / distance
    color: '#60A5FA', // Light blue
    unit: 'Pax'
  },
  [CargoType.COAL]: {
    name: 'Carbón',
    value: 8,
    color: '#9CA3AF', // Gray
    unit: 'Ton'
  },
  [CargoType.WOOD]: {
    name: 'Madera',
    value: 10,
    color: '#34D399', // Emerald
    unit: 'Troncos'
  },
  [CargoType.WHEAT]: {
    name: 'Trigo',
    value: 15,
    color: '#FBBF24', // Amber
    unit: 'Sacos'
  },
  [CargoType.STEEL]: {
    name: 'Acero',
    value: 25,
    color: '#F87171', // Rose
    unit: 'Vigas'
  }
};

/**
 * Tick handler for stations:
 * Generates produced cargo and consumes consumed cargo periodically
 */
export function tickStations(stations: Station[], timeDelta: number, level: number): Station[] {
  return stations.map(station => {
    if (!station.isUnlocked) return station;

    const updatedCargo = { ...station.cargoAmount };
    const maxCapacity = station.cargoMax;

    // Rates of cargo generation depend slightly on level
    const rateMultiplier = 1 + (level - 1) * 0.15;

    // Cargo generation
    station.produces.forEach(cargo => {
      const current = updatedCargo[cargo] || 0;
      if (current < maxCapacity) {
        // Passenger generates faster than heavy industrial cargo
        const rate = (cargo === CargoType.PASSENGER ? 1.8 : 0.8) * rateMultiplier * timeDelta;
        updatedCargo[cargo] = Math.min(maxCapacity, current + rate);
      }
    });

    // Consumption of goods (slow decrease if present, representing cities consuming materials)
    station.consumes.forEach(cargo => {
      const current = updatedCargo[cargo] || 0;
      if (current > 0) {
        // Slow consumption rate
        const rate = 0.2 * timeDelta;
        updatedCargo[cargo] = Math.max(0, current - rate);
      }
    });

    return {
      ...station,
      cargoAmount: updatedCargo
    };
  });
}
