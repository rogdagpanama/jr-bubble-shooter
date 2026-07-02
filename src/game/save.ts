/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameState } from './types';
import { INITIAL_STATIONS } from './station';
import { INITIAL_LINKS, INITIAL_UPGRADES } from './economy';

const SAVE_KEY = 'railway_empire_lite_save_v1';

/**
 * Saves the game state to LocalStorage
 */
export function saveGame(state: GameState): boolean {
  try {
    const serialized = JSON.stringify({
      money: state.money,
      level: state.level,
      xp: state.xp,
      xpToNextLevel: state.xpToNextLevel,
      // Store stations unlock and cargo state
      stations: state.stations.map(s => ({
        id: s.id,
        isUnlocked: s.isUnlocked,
        cargoAmount: s.cargoAmount
      })),
      // Store link built states
      links: state.links.map(l => ({
        id: l.id,
        isBuilt: l.isBuilt
      })),
      // Store purchased trains
      trains: state.trains,
      // Store upgrade levels
      upgrades: state.upgrades.map(u => ({
        id: u.id,
        level: u.level,
        cost: u.cost
      })),
      // Stats
      stats: state.stats,
      // Options
      isDarkMode: state.isDarkMode,
      volume: state.volume
    });

    localStorage.setItem(SAVE_KEY, serialized);
    return true;
  } catch (error) {
    console.error('Error saving game state:', error);
    return false;
  }
}

/**
 * Loads the game state from LocalStorage
 */
export function loadGame(): GameState | null {
  try {
    const serialized = localStorage.getItem(SAVE_KEY);
    if (!serialized) return null;

    const data = JSON.parse(serialized);
    if (!data) return null;

    // Reconstruct stations with default metadata merged
    const stations = INITIAL_STATIONS.map(baseStation => {
      const savedStation = data.stations?.find((s: any) => s.id === baseStation.id);
      if (savedStation) {
        return {
          ...baseStation,
          isUnlocked: savedStation.isUnlocked,
          cargoAmount: { ...baseStation.cargoAmount, ...savedStation.cargoAmount }
        };
      }
      return baseStation;
    });

    // Reconstruct links built states
    const links = INITIAL_LINKS.map(baseLink => {
      const savedLink = data.links?.find((l: any) => l.id === baseLink.id);
      if (savedLink) {
        return {
          ...baseLink,
          isBuilt: savedLink.isBuilt
        };
      }
      return baseLink;
    });

    // Reconstruct upgrades
    const upgrades = INITIAL_UPGRADES.map(baseUpgrade => {
      const savedUpgrade = data.upgrades?.find((u: any) => u.id === baseUpgrade.id);
      if (savedUpgrade) {
        return {
          ...baseUpgrade,
          level: savedUpgrade.level,
          cost: savedUpgrade.cost
        };
      }
      return baseUpgrade;
    });

    // Reconstruct the full game state
    const loadedState: GameState = {
      money: typeof data.money === 'number' ? data.money : 1000,
      level: typeof data.level === 'number' ? data.level : 1,
      xp: typeof data.xp === 'number' ? data.xp : 0,
      xpToNextLevel: typeof data.xpToNextLevel === 'number' ? data.xpToNextLevel : 100,
      stations,
      links,
      trains: Array.isArray(data.trains) ? data.trains : [],
      upgrades,
      stats: {
        totalEarned: data.stats?.totalEarned || 0,
        totalPassengersTransported: data.stats?.totalPassengersTransported || 0,
        totalCargoTransported: data.stats?.totalCargoTransported || 0,
        earningsHistory: Array.isArray(data.stats?.earningsHistory) ? data.stats.earningsHistory : [],
        lastEPM: data.stats?.lastEPM || 0
      },
      isDarkMode: typeof data.isDarkMode === 'boolean' ? data.isDarkMode : false,
      volume: typeof data.volume === 'number' ? data.volume : 0.5,
      isFullscreen: false // Do not persist full screen state
    };

    return loadedState;
  } catch (error) {
    console.error('Error loading game state:', error);
    return null;
  }
}

/**
 * Clears the saved game from LocalStorage
 */
export function clearSaveGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.error('Error clearing save game:', error);
  }
}
