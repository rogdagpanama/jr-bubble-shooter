/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Train, Station, RailwayLink, CargoType, Particle } from './types';
import { calculateEarnings, getMaintenanceCost, getUpgradeMultiplier } from './economy';
import { CARGO_METADATA } from './station';
import { gameAudio } from './audio';

// Base speeds for locomotive types (pixels per second)
export const LOCOMOTIVE_SPEEDS = {
  steam: 45,
  diesel: 75,
  electric: 110
};

// Colors associated with locomotive types
export const LOCOMOTIVE_COLORS = {
  steam: '#EF4444',    // Red
  diesel: '#3B82F6',   // Blue
  electric: '#10B981'  // Emerald
};

// Help generate a default locomotive name
export function generateTrainName(index: number, type: 'steam' | 'diesel' | 'electric'): string {
  const prefixes = {
    steam: 'Halcón de Hierro',
    diesel: 'Expreso del Desierto',
    electric: 'Rayo Eléctrico'
  };
  return `${prefixes[type]} #${index + 1}`;
}

/**
 * Updates all trains, performing movement, loading/unloading, cargo management, and earnings generation.
 */
export function tickTrains(
  trains: Train[],
  stations: Station[],
  links: RailwayLink[],
  speedUpgradeLevel: number,
  capacityUpgradeLevel: number,
  fuelUpgradeLevel: number,
  timeDelta: number,
  addParticles: (particles: Particle[]) => void,
  addMoney: (amount: number) => void,
  trackTransport: (isPassenger: boolean, amount: number) => void
): { updatedTrains: Train[]; updatedStations: Station[] } {
  
  // Clone stations to update them inside
  const nextStations = stations.map(s => ({
    ...s,
    cargoAmount: { ...s.cargoAmount }
  }));

  const updatedTrains = trains.map(train => {
    const nextTrain = { ...train, carriages: train.carriages.map(c => ({ ...c })) };

    // If train route is empty, it remains idle
    if (nextTrain.currentRoute.length < 2) {
      nextTrain.status = 'idle';
      return nextTrain;
    }

    // Get current and next destination station IDs
    const currentRouteIndex = nextTrain.currentRouteIndex;
    const fromStationId = nextTrain.currentRoute[currentRouteIndex];
    const nextRouteIndex = (currentRouteIndex + 1) % nextTrain.currentRoute.length;
    const toStationId = nextTrain.currentRoute[nextRouteIndex];

    const fromStation = nextStations.find(s => s.id === fromStationId);
    const toStation = nextStations.find(s => s.id === toStationId);

    if (!fromStation || !toStation || !fromStation.isUnlocked || !toStation.isUnlocked) {
      nextTrain.status = 'idle';
      return nextTrain;
    }

    // Check if there is a built link between from and to stations
    const activeLink = links.find(l => 
      l.isBuilt && 
      ((l.from === fromStationId && l.to === toStationId) || 
       (l.from === toStationId && l.to === fromStationId))
    );

    if (!activeLink) {
      nextTrain.status = 'idle';
      return nextTrain;
    }

    // Maintenance cost (deducted periodically)
    const mCost = getMaintenanceCost(nextTrain, fuelUpgradeLevel, timeDelta);
    addMoney(-mCost);

    // SMOKE PARTICLES (emitted by moving trains)
    if (nextTrain.status === 'moving' && Math.random() < 0.2) {
      // Calculate train position in pixel space
      const trainX = fromStation.x + (toStation.x - fromStation.x) * nextTrain.progress;
      const trainY = fromStation.y + (toStation.y - fromStation.y) * nextTrain.progress;
      
      // Random puff vector
      const particle: Particle = {
        x: trainX,
        y: trainY - 8,
        vx: (Math.random() - 0.5) * 10 - 2,
        vy: -Math.random() * 15 - 10,
        alpha: 0.8,
        size: 5 + Math.random() * 5,
        color: '#D1D5DB', // Light smoke gray
        life: 0,
        maxLife: 1.0 + Math.random() * 0.8,
        type: 'smoke'
      };
      addParticles([particle]);
    }

    // State machine
    if (nextTrain.status === 'idle') {
      // If idle but there is a link, start moving
      nextTrain.fromStationId = fromStationId;
      nextTrain.toStationId = toStationId;
      nextTrain.progress = 0;
      nextTrain.status = 'moving';
    } 
    else if (nextTrain.status === 'moving') {
      // Base Speed depends on engine type
      const baseSpeed = LOCOMOTIVE_SPEEDS[nextTrain.locomotiveType] || LOCOMOTIVE_SPEEDS.steam;
      // Upgrade multiplier
      const speedUpgradeMultiplier = 1 + (speedUpgradeLevel - 1) * 0.25;
      const finalSpeed = baseSpeed * speedUpgradeMultiplier * nextTrain.speedMultiplier;
      
      // Progress increment = speed / link distance
      const distance = activeLink.distance;
      const progressIncrement = (finalSpeed * timeDelta) / distance;
      
      nextTrain.progress = Math.min(1.0, nextTrain.progress + progressIncrement);

      if (nextTrain.progress >= 1.0) {
        // Arrived at destination!
        nextTrain.status = 'loading';
        nextTrain.loadingTimer = 1.8; // 1.8 seconds loading pause
        
        // UNLOAD PHASE (Process cargo unloading at destination)
        let totalRevenue = 0;
        let cargoUnloadedText = '';
        let totalUnloadedUnits = 0;
        let carriesPassenger = false;

        nextTrain.carriages.forEach(carriage => {
          if (carriage.currentAmount > 0) {
            const cargoType = carriage.type;
            const isCity = toStation.type === 'city';
            const isConsumed = toStation.consumes.includes(cargoType);

            // Passengers can be unloaded in any City. Cargo can be unloaded in matching consumes or any City (at a discount if not specifically consumed)
            const canUnload = isConsumed || (cargoType === CargoType.PASSENGER && isCity) || (cargoType !== CargoType.PASSENGER && isCity);

            if (canUnload) {
              // Calculate revenue
              let amountToUnload = carriage.currentAmount;
              let revenue = calculateEarnings(cargoType, amountToUnload, fromStation, toStation);
              
              // Non-preferred cargo to a city gets 30% penalty
              if (!isConsumed && cargoType !== CargoType.PASSENGER && isCity) {
                revenue = Math.round(revenue * 0.7);
              }

              totalRevenue += revenue;
              totalUnloadedUnits += amountToUnload;
              if (cargoType === CargoType.PASSENGER) {
                carriesPassenger = true;
              }

              // Create floating earnings text
              const metadata = CARGO_METADATA[cargoType];
              cargoUnloadedText += `${Math.round(amountToUnload)} ${metadata?.unit || ''} de ${metadata?.name || ''}, `;

              // Clear carriage
              carriage.currentAmount = 0;
            }
          }
        });

        // Apply Earnings & stats
        if (totalRevenue > 0) {
          addMoney(totalRevenue);
          trackTransport(carriesPassenger, totalUnloadedUnits);

          // Audio and visuals
          gameAudio.playCoin();

          // Particle effect (Float text + coin sparkle)
          const textParticle: Particle = {
            x: toStation.x,
            y: toStation.y - 30,
            vx: 0,
            vy: -35,
            alpha: 1.0,
            size: 16,
            color: '#10B981', // green
            life: 0,
            maxLife: 2.0,
            type: 'text',
            text: `+$${totalRevenue}`
          };

          const sparkParticles: Particle[] = Array.from({ length: 12 }).map(() => ({
            x: toStation.x,
            y: toStation.y,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60 - 20,
            alpha: 1.0,
            size: 3 + Math.random() * 3,
            color: '#F59E0B', // gold
            life: 0,
            maxLife: 0.8 + Math.random() * 0.5,
            type: 'spark'
          }));

          addParticles([textParticle, ...sparkParticles]);
        }
      }
    } 
    else if (nextTrain.status === 'loading') {
      nextTrain.loadingTimer -= timeDelta;

      if (nextTrain.loadingTimer <= 0) {
        // LOADING PHASE (Completed wait, load cargo for the NEXT leg of the route)
        // Find current station station object
        const currentStation = nextStations.find(s => s.id === toStationId);
        
        if (currentStation) {
          nextTrain.carriages.forEach(carriage => {
            const cargoType = carriage.type;
            const producesCargo = currentStation.produces.includes(cargoType);

            // If station produces this carriage's cargo, fill it!
            if (producesCargo && carriage.currentAmount === 0) {
              const availableInStation = currentStation.cargoAmount[cargoType] || 0;
              if (availableInStation > 0) {
                // Carriage capacity scales with Capacity Upgrade level
                const baseCarriageCapacity = carriage.capacity; // initialized from base
                // Capacity multiplier
                const upgradeCap = getUpgradeMultiplier('capacity', capacityUpgradeLevel);
                const finalCapacity = upgradeCap; // we use upgrade value as capacity
                
                const amountToLoad = Math.min(finalCapacity, availableInStation);
                
                carriage.currentAmount = amountToLoad;
                carriage.capacity = finalCapacity; // synchronize capacity

                // Deduct from station storage
                currentStation.cargoAmount[cargoType] = Math.max(0, availableInStation - amountToLoad);

                // Load sparkle particle
                const meta = CARGO_METADATA[cargoType];
                const textPart: Particle = {
                  x: currentStation.x,
                  y: currentStation.y - 25,
                  vx: 0,
                  vy: -20,
                  alpha: 1.0,
                  size: 12,
                  color: meta?.color || '#FFFFFF',
                  life: 0,
                  maxLife: 1.5,
                  type: 'text',
                  text: `Cargando ${Math.round(amountToLoad)} ${meta?.name || ''}`
                };
                addParticles([textPart]);
              }
            }
          });
        }

        // Advance route to next station
        const nextRouteIndex = (currentRouteIndex + 1) % nextTrain.currentRoute.length;
        nextTrain.currentRouteIndex = nextRouteIndex;
        
        // Setup next trip
        const nextFromId = nextTrain.currentRoute[nextRouteIndex];
        const finalNextIndex = (nextRouteIndex + 1) % nextTrain.currentRoute.length;
        const nextToId = nextTrain.currentRoute[finalNextIndex];

        // Is next track built?
        const nextLink = links.find(l => 
          l.isBuilt && 
          ((l.from === nextFromId && l.to === nextToId) || 
           (l.from === nextToId && l.to === nextFromId))
        );

        if (nextLink) {
          nextTrain.fromStationId = nextFromId;
          nextTrain.toStationId = nextToId;
          nextTrain.progress = 0;
          nextTrain.status = 'moving';
          
          // Play horn occasionally when departing from city stations
          if (Math.random() < 0.45) {
            gameAudio.playHorn();
          }
        } else {
          nextTrain.status = 'idle';
        }
      }
    }

    return nextTrain;
  });

  return {
    updatedTrains,
    updatedStations: nextStations
  };
}
