/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { GameState, Train, Station, RailwayLink, CargoType, Particle } from './game/types';
import { INITIAL_STATIONS, tickStations, CARGO_METADATA } from './game/station';
import { INITIAL_LINKS, INITIAL_UPGRADES, CARRIAGE_COST, getLocomotiveCost } from './game/economy';
import { tickTrains, generateTrainName } from './game/train';
import { saveGame, loadGame, clearSaveGame } from './game/save';
import { GameCanvas } from './components/GameCanvas';
import { GameUI } from './components/GameUI';
import { gameAudio } from './game/audio';
import { 
  Train as TrainIcon, 
  Map, 
  Info, 
  Play, 
  Settings, 
  Award, 
  Volume2, 
  VolumeX, 
  Sun, 
  Moon, 
  Sparkles, 
  BookOpen, 
  User, 
  HelpCircle 
} from 'lucide-react';

export default function App() {
  // Menu Navigation State: 'menu' | 'credits' | 'playing' | 'settings_menu'
  const [navState, setNavState] = useState<'menu' | 'credits' | 'playing' | 'settings_menu'>('menu');
  
  // Primary game state
  const [gameState, setGameState] = useState<GameState>({
    money: 1000,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    stations: INITIAL_STATIONS,
    links: INITIAL_LINKS,
    trains: [],
    upgrades: INITIAL_UPGRADES,
    stats: {
      totalEarned: 0,
      totalPassengersTransported: 0,
      totalCargoTransported: 0,
      earningsHistory: [],
      lastEPM: 0
    },
    isDarkMode: false,
    volume: 0.5,
    isFullscreen: false
  });

  // Destructure state values for direct scope access
  const { money, level, xp, xpToNextLevel, stations, links, trains, upgrades, stats } = gameState;

  // Toggle Theme
  const toggleTheme = () => {
    gameAudio.playClick();
    setGameState(prev => ({ ...prev, isDarkMode: !prev.isDarkMode }));
  };

  // Fullscreen trigger
  const toggleFullscreen = () => {
    gameAudio.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setGameState(prev => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen().catch(() => {});
      setGameState(prev => ({ ...prev, isFullscreen: false }));
    }
  };

  // Local storage save verification (on boot)
  const [hasSave, setHasSave] = useState<boolean>(false);
  useEffect(() => {
    const saved = loadGame();
    if (saved) {
      setHasSave(true);
    }
  }, [navState]);

  // Particles (visual pops drawn on canvas: smoke, sparks, texts)
  const [particles, setParticles] = useState<Particle[]>([]);
  
  // Currently selected train for detail views / route configs
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);

  // Selected station for info overlays on map
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Celebratory Overlay for Leveling Up
  const [showLevelUpAlert, setShowLevelUpAlert] = useState<boolean>(false);
  const [unlockedLevel, setUnlockedLevel] = useState<number>(1);

  // Sync volume with game audio on boot/changes
  useEffect(() => {
    gameAudio.setVolume(gameState.volume);
  }, [gameState.volume]);

  // Handle Dark Mode document class syncing
  useEffect(() => {
    if (gameState.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [gameState.isDarkMode]);

  // TICK GAME ENGINE LOOP
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  const gameTick = (time: number) => {
    if (previousTimeRef.current !== null) {
      // Delta time in seconds (cap at max 0.1s to prevent huge jumps on tab sleep)
      const deltaTime = Math.min(0.1, (time - previousTimeRef.current) / 1000);
      
      if (navState === 'playing') {
        // 1. Tick Stations cargo generation and consumption
        setGameState(prevState => {
          let nextStations = tickStations(prevState.stations, deltaTime, prevState.level);
          
          // Auxiliary container for newly generated particles
          let newP: Particle[] = [];

          // Helper to register money transactions
          let moneyEarnedThisTick = 0;
          let passengersAddedThisTick = 0;
          let cargoAddedThisTick = 0;

          const addMoney = (amount: number) => {
            moneyEarnedThisTick += amount;
          };

          const addParticles = (pList: Particle[]) => {
            newP = [...newP, ...pList];
          };

          const trackTransport = (isPassenger: boolean, amount: number) => {
            if (isPassenger) passengersAddedThisTick += amount;
            else cargoAddedThisTick += amount;
          };

          // Active upgrade levels
          const speedUpgradeLevel = prevState.upgrades.find(u => u.category === 'speed')?.level || 1;
          const capacityUpgradeLevel = prevState.upgrades.find(u => u.category === 'capacity')?.level || 1;
          const fuelUpgradeLevel = prevState.upgrades.find(u => u.category === 'fuel')?.level || 1;

          // 2. Tick Train physics and actions
          const { updatedTrains, updatedStations } = tickTrains(
            prevState.trains,
            nextStations,
            prevState.links,
            speedUpgradeLevel,
            capacityUpgradeLevel,
            fuelUpgradeLevel,
            deltaTime,
            addParticles,
            addMoney,
            trackTransport
          );

          // Update particles state
          if (newP.length > 0) {
            setParticles(prev => [...prev, ...newP]);
          }

          // Handle XP gain and potential Level Up
          let nextXp = prevState.xp;
          let nextLevel = prevState.level;
          let nextXpToNextLevel = prevState.xpToNextLevel;
          
          // Unloading cargo adds XP (e.g., 2.5 XP per cargo unit transported)
          const xpAdded = (passengersAddedThisTick + cargoAddedThisTick) * 2.5;
          if (xpAdded > 0) {
            nextXp += xpAdded;
            
            // Check Level Up
            if (nextXp >= nextXpToNextLevel) {
              nextXp = Math.max(0, nextXp - nextXpToNextLevel);
              nextLevel += 1;
              nextXpToNextLevel = nextLevel * 150 + 100;
              
              // Trigger Level-Up HUD celebrate effect
              setUnlockedLevel(nextLevel);
              setShowLevelUpAlert(true);
              gameAudio.playLevelUp();
            }
          }

          // Manage financial history slider for EPM (Earnings Per Minute)
          const now = Date.now();
          let nextHistory = [...prevState.stats.earningsHistory];
          if (moneyEarnedThisTick > 0) {
            nextHistory.push({ time: now, amount: moneyEarnedThisTick });
          }
          // Filter records older than 60 seconds
          nextHistory = nextHistory.filter(h => now - h.time < 60000);

          // Sum last 60 seconds to find exact current EPM
          const currentEPM = nextHistory.reduce((sum, h) => sum + h.amount, 0);

          // Update money balance (add earnings, deduct maintenance)
          const finalMoney = Math.max(0, prevState.money + moneyEarnedThisTick);

          return {
            ...prevState,
            money: finalMoney,
            level: nextLevel,
            xp: nextXp,
            xpToNextLevel: nextXpToNextLevel,
            stations: updatedStations,
            trains: updatedTrains,
            stats: {
              totalEarned: prevState.stats.totalEarned + Math.max(0, moneyEarnedThisTick),
              totalPassengersTransported: prevState.stats.totalPassengersTransported + passengersAddedThisTick,
              totalCargoTransported: prevState.stats.totalCargoTransported + cargoAddedThisTick,
              earningsHistory: nextHistory,
              lastEPM: currentEPM
            }
          };
        });
      }
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(gameTick);
  };

  // Launch and dispose game ticker
  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameTick);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [navState]);

  // PERIODIC AUTO-SAVE STATE TRIGGER (Every 8 seconds when playing)
  useEffect(() => {
    if (navState !== 'playing') return;

    const saveTimer = setInterval(() => {
      saveGame(gameState);
    }, 8000);

    return () => clearInterval(saveTimer);
  }, [navState, gameState]);

  // INITIALIZE BRAND NEW GAME
  const startNewGame = () => {
    gameAudio.playBuy();
    clearSaveGame();

    // Default starting state
    const startingState: GameState = {
      money: 1000,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      stations: INITIAL_STATIONS.map(s => ({
        ...s,
        isUnlocked: s.id === 'centralia' || s.id === 'carbonia' || s.id === 'silvia', // Centralia, Coal, Wood are free
        cargoAmount: s.id === 'centralia' ? { [CargoType.PASSENGER]: 5 } : s.cargoAmount
      })),
      links: INITIAL_LINKS.map(l => ({
        ...l,
        isBuilt: l.id === 'centralia-carbonia' || l.id === 'centralia-silvia' // Starter links built
      })),
      trains: [
        // One default starter train (Steam) running Centralia <-> Carbonia (Coal mine)
        {
          id: 'train_1',
          name: 'Halcón de Hierro #1',
          locomotiveType: 'steam',
          speedMultiplier: 1.0,
          capacityMultiplier: 1.0,
          fuelEfficiency: 1.0,
          carriages: [
            { id: 'c_1', type: CargoType.PASSENGER, capacity: 5, currentAmount: 0 }
          ],
          currentRoute: ['centralia', 'carbonia'],
          currentRouteIndex: 0,
          progress: 0,
          direction: 1,
          status: 'moving',
          loadingTimer: 0,
          fromStationId: 'centralia',
          toStationId: 'carbonia',
          maxCarriages: 4,
          color: '#EF4444'
        }
      ],
      upgrades: INITIAL_UPGRADES,
      stats: {
        totalEarned: 0,
        totalPassengersTransported: 0,
        totalCargoTransported: 0,
        earningsHistory: [],
        lastEPM: 0
      },
      isDarkMode: gameState.isDarkMode,
      volume: gameState.volume,
      isFullscreen: false
    };

    setGameState(startingState);
    setSelectedTrain(startingState.trains[0]);
    setSelectedStation(null);
    setParticles([]);
    setNavState('playing');
  };

  // CONTINUE SAVED GAME PROGRESSION
  const continueGame = () => {
    const saved = loadGame();
    if (saved) {
      gameAudio.playBuy();
      setGameState(saved);
      if (saved.trains.length > 0) {
        setSelectedTrain(saved.trains[0]);
      }
      setNavState('playing');
    }
  };

  // BUY NEW LOCOMOTIVE LOOPS
  const handleBuyLocomotive = (type: 'steam' | 'diesel' | 'electric') => {
    const cost = getLocomotiveCost(gameState.trains.length);
    if (gameState.money < cost) return;

    gameAudio.playBuy();

    const colors = { steam: '#EF4444', diesel: '#3B82F6', electric: '#10B981' };

    const newTrain: Train = {
      id: `train_${Date.now()}`,
      name: generateTrainName(gameState.trains.length, type),
      locomotiveType: type,
      speedMultiplier: type === 'steam' ? 1.0 : type === 'diesel' ? 1.25 : 1.6,
      capacityMultiplier: 1.0,
      fuelEfficiency: type === 'steam' ? 1.2 : type === 'diesel' ? 0.9 : 0.7,
      carriages: [], // starts without carriage cars, needs to purchase individually
      currentRoute: ['centralia', 'carbonia'], // default route Centralia-Carbonia
      currentRouteIndex: 0,
      progress: 0,
      direction: 1,
      status: 'idle',
      loadingTimer: 0,
      fromStationId: 'centralia',
      toStationId: 'carbonia',
      maxCarriages: type === 'steam' ? 3 : type === 'diesel' ? 5 : 7,
      color: colors[type]
    };

    setGameState(prev => ({
      ...prev,
      money: prev.money - cost,
      trains: [...prev.trains, newTrain]
    }));

    // Auto-select newly purchased locomotive
    setSelectedTrain(newTrain);
  };

  // BUY AND ATTACH CARRIAGE TO TRAIN
  const handleBuyCarriage = (trainId: string, type: CargoType) => {
    if (gameState.money < CARRIAGE_COST) return;

    gameAudio.playBuy();

    // Capacity multiplier comes from Tech level
    const capacityUpgradeLevel = gameState.upgrades.find(u => u.category === 'capacity')?.level || 1;
    const baseCap = capacityUpgradeLevel === 1 ? 5 : capacityUpgradeLevel === 2 ? 10 : capacityUpgradeLevel === 3 ? 16 : capacityUpgradeLevel === 4 ? 24 : 35;

    setGameState(prev => {
      const updatedTrains = prev.trains.map(train => {
        if (train.id === trainId) {
          // Check limits
          if (train.carriages.length >= train.maxCarriages) {
            alert('¡Tu locomotora no tiene suficiente potencia para arrastrar más vagones! Libera espacio o compra una locomotora superior.');
            return train;
          }

          const newCarriage = {
            id: `c_${Date.now()}`,
            type,
            capacity: baseCap,
            currentAmount: 0
          };

          const updated = {
            ...train,
            carriages: [...train.carriages, newCarriage]
          };

          // Synchronize selection state in real-time
          if (selectedTrain?.id === train.id) {
            setSelectedTrain(updated);
          }

          return updated;
        }
        return train;
      });

      return {
        ...prev,
        money: prev.money - CARRIAGE_COST,
        trains: updatedTrains
      };
    });
  };

  // REMOVE CARRIAGE INDIVIDUALLY (Sell it back for 60% of the cost)
  const handleRemoveCarriage = (trainId: string, carriageId: string) => {
    gameAudio.playClick();
    const refund = Math.round(CARRIAGE_COST * 0.6);

    setGameState(prev => {
      const updatedTrains = prev.trains.map(train => {
        if (train.id === trainId) {
          const updated = {
            ...train,
            carriages: train.carriages.filter(c => c.id !== carriageId)
          };

          if (selectedTrain?.id === train.id) {
            setSelectedTrain(updated);
          }

          return updated;
        }
        return train;
      });

      return {
        ...prev,
        money: prev.money + refund,
        trains: updatedTrains
      };
    });
  };

  // CONFIGURE / MODIFY TRAIN ROUTING loop
  const handleUpdateRoute = (trainId: string, nextRoute: string[]) => {
    setGameState(prev => {
      const updatedTrains = prev.trains.map(train => {
        if (train.id === trainId) {
          const updated = {
            ...train,
            currentRoute: nextRoute,
            // Reset route progress indexes to prevent indexOutOfBound crashes
            currentRouteIndex: 0,
            status: nextRoute.length < 2 ? 'idle' as const : train.status
          };

          if (selectedTrain?.id === train.id) {
            setSelectedTrain(updated);
          }

          return updated;
        }
        return train;
      });

      return {
        ...prev,
        trains: updatedTrains
      };
    });
  };

  // UPGRADE NETWORK GLOBAL TECH TIER
  const handleUpgradeTech = (category: 'speed' | 'capacity' | 'fuel') => {
    const upgrade = gameState.upgrades.find(u => u.category === category);
    if (!upgrade) return;

    const cost = upgrade.cost;
    if (gameState.money < cost || upgrade.level >= upgrade.maxLevel) return;

    gameAudio.playLevelUp();

    setGameState(prev => {
      const updatedUpgrades = prev.upgrades.map(u => {
        if (u.category === category) {
          const nextLvl = u.level + 1;
          const nextCosts = {
            speed: [250, 600, 1200, 2500, 0],
            capacity: [200, 500, 1100, 2200, 0],
            fuel: [150, 400, 850, 1800, 0]
          };
          const nextCost = nextCosts[category][Math.min(nextLvl - 1, 4)] || 99999;
          
          return {
            ...u,
            level: nextLvl,
            cost: nextCost
          };
        }
        return u;
      });

      // If capacity was upgraded, retroactively scale all empty train carriages to the new capacity limits!
      let updatedTrains = prev.trains;
      if (category === 'capacity') {
        const capacities = [5, 10, 16, 24, 35];
        const nextCap = capacities[Math.min(upgrade.level, 4)];
        
        updatedTrains = prev.trains.map(train => ({
          ...train,
          carriages: train.carriages.map(car => ({
            ...car,
            capacity: nextCap
          }))
        }));

        // Keep current selected train updated
        if (selectedTrain) {
          const currentT = updatedTrains.find(t => t.id === selectedTrain.id);
          if (currentT) setSelectedTrain(currentT);
        }
      }

      return {
        ...prev,
        money: prev.money - cost,
        upgrades: updatedUpgrades,
        trains: updatedTrains
      };
    });
  };

  // UNLOCK NEW NETWORK CITY NODES
  const handleUnlockStation = (stationId: string) => {
    const station = gameState.stations.find(s => s.id === stationId);
    if (!station) return;

    const cost = station.costToUnlock;
    if (gameState.money < cost || gameState.level < station.levelRequired) {
      alert(`¡No puedes desbloquear esta estación! Requiere Nivel ${station.levelRequired} y $${cost}.`);
      return;
    }

    gameAudio.playBuy();

    setGameState(prev => {
      // 1. Mark station unlocked
      const updatedStations = prev.stations.map(s => {
        if (s.id === stationId) {
          return { ...s, isUnlocked: true };
        }
        return s;
      });

      // 2. Mark its direct railway connections to the central hub built!
      // This ensures unlocking a city instantly lets you connect trains to it
      const updatedLinks = prev.links.map(link => {
        if (
          (link.from === 'centralia' && link.to === stationId) ||
          (link.to === 'centralia' && link.from === stationId)
        ) {
          return { ...link, isBuilt: true };
        }
        return link;
      });

      return {
        ...prev,
        money: prev.money - cost,
        stations: updatedStations,
        links: updatedLinks
      };
    });

    // Create an aesthetic popup celebrate particle list
    const pos = station;
    const celebrationText: Particle = {
      x: pos.x,
      y: pos.y - 35,
      vx: 0,
      vy: -20,
      alpha: 1.0,
      size: 14,
      color: '#10B981', // green
      life: 0,
      maxLife: 2.5,
      type: 'text',
      text: '¡Ciudad Conectada!'
    };
    setParticles(prev => [...prev, celebrationText]);
  };

  // MANUAL RAILWAY LINKS BUILD IN MAP (When user clicks dotted lines)
  const handleBuildLink = (linkId: string) => {
    const link = gameState.links.find(l => l.id === linkId);
    if (!link) return;

    const fromSt = gameState.stations.find(s => s.id === link.from);
    const toSt = gameState.stations.find(s => s.id === link.to);
    if (!fromSt || !toSt) return;

    // Check level locks
    const levelReq = Math.max(fromSt.levelRequired, toSt.levelRequired);
    if (gameState.level < levelReq) {
      alert(`¡Para construir esta línea necesitas alcanzar el Nivel ${levelReq}!`);
      return;
    }

    if (gameState.money < link.cost) {
      alert('¡Fondos insuficientes para construir esta vía férrea!');
      return;
    }

    gameAudio.playBuy();

    setGameState(prev => {
      const updatedLinks = prev.links.map(l => {
        if (l.id === linkId) return { ...l, isBuilt: true };
        return l;
      });

      return {
        ...prev,
        money: prev.money - link.cost,
        links: updatedLinks
      };
    });

    // Splendid visual pops on link construction
    const cx = fromSt.x + (toSt.x - fromSt.x) / 2;
    const cy = fromSt.y + (toSt.y - fromSt.y) / 2;
    const popText: Particle = {
      x: cx,
      y: cy - 25,
      vx: 0,
      vy: -22,
      alpha: 1.0,
      size: 13,
      color: '#34D399',
      life: 0,
      maxLife: 2.0,
      type: 'text',
      text: '¡Vía Construida!'
    };
    setParticles(prev => [...prev, popText]);
  };

  // FULL GAME DATA FACTORY RESET
  const handleResetGame = () => {
    clearSaveGame();
    startNewGame();
  };

  return (
    <div className="min-h-screen font-sans bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-100 flex flex-col justify-between select-none transition-colors duration-300">
      
      {/* 1. MAIN WELCOME SCREEN MENU */}
      {navState === 'menu' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto space-y-8 animate-fade-in" id="welcome-menu">
          
          {/* Logo & Slogan Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
              <TrainIcon className="h-10 w-10 animate-bounce" />
              <span className="text-3xl font-black uppercase tracking-widest font-mono">RE</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white">
              Railway Empire <span className="text-emerald-500">Lite</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Diseña, construye y gestiona tu propio imperio ferroviario. Conecta ciudades y transporta materias industriales.
            </p>
          </div>

          {/* Menu Action buttons */}
          <div className="flex flex-col gap-3 w-64">
            <button
              onClick={startNewGame}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition"
            >
              Nuevo Juego
            </button>
            
            <button
              disabled={!hasSave}
              onClick={continueGame}
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-800 dark:text-slate-200 font-bold py-3 px-6 rounded-xl active:scale-95 transition disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-900"
            >
              Continuar Partida
            </button>

            <button
              onClick={() => { gameAudio.playClick(); setNavState('settings_menu'); }}
              className="bg-slate-200/60 hover:bg-slate-200 text-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:text-slate-300 font-bold py-2.5 px-6 rounded-xl active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Settings className="h-4 w-4" /> Configuración
            </button>

            <button
              onClick={() => { gameAudio.playClick(); setNavState('credits'); }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold py-1 transition"
            >
              Créditos y Licencia
            </button>
          </div>

          {/* Miniature train tracks design below menu */}
          <div className="w-80 h-10 border-b-2 border-dashed border-slate-300 dark:border-slate-800 relative opacity-40">
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-xl animate-pulse">🚂 🚃 🚃</span>
          </div>
        </div>
      )}

      {/* 2. SETTINGS SCREEN MENU */}
      {navState === 'settings_menu' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-6" id="settings-menu">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Ajustes Generales</h2>
            <p className="text-xs text-slate-400">Personaliza tu experiencia de juego y controles.</p>
          </div>

          <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 text-left shadow-md">
            
            {/* Audio Settings */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                {gameState.volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Volumen del Sonido
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={gameState.volume}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value);
                    setGameState(prev => ({ ...prev, volume: vol }));
                  }}
                  className="flex-1 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold font-mono w-8 text-right">{Math.round(gameState.volume * 100)}%</span>
              </div>
            </div>

            {/* Dark Mode */}
            <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tema Visual Oscuro</span>
                <p className="text-[11px] text-slate-400 leading-none">Activa para jugar con descanso ocular.</p>
              </div>
              <button
                onClick={toggleTheme}
                className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition"
              >
                {gameState.isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>

            {/* Fullscreen */}
            <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Modo Pantalla Completa</span>
                <p className="text-[11px] text-slate-400 leading-none">Maximiza el canvas de juego.</p>
              </div>
              <button
                onClick={toggleFullscreen}
                className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Activar
              </button>
            </div>

            {/* Quick Tutorial Rules */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-slate-400" /> Manual del Conductor (Tutorial)
              </span>
              <ul className="text-[11px] text-slate-500 dark:text-slate-400 list-disc list-inside space-y-1">
                <li>El juego guarda tu progreso de forma **Automática** en LocalStorage.</li>
                <li>Los trenes viajan recolectando y entregando materias de forma cíclica.</li>
                <li>Conectar materias a Centralia te reportará dinero e XP.</li>
                <li>Toca en las vías punteadas de colores para construirlas y habilitar rutas.</li>
                <li>Gasta dinero en Upgrades globales para expandir tu potencia rápidamente.</li>
              </ul>
            </div>

          </div>

          <button
            onClick={() => { gameAudio.playClick(); setNavState('menu'); }}
            className="bg-slate-800 hover:bg-slate-900 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 py-2.5 px-6 rounded-xl font-bold text-sm active:scale-95 transition"
          >
            Volver al Menú
          </button>
        </div>
      )}

      {/* 3. CREDITS SCREEN MENU */}
      {navState === 'credits' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-6" id="credits-screen">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Créditos de Creación</h2>
            <p className="text-xs text-slate-400">Railway Empire Lite es un juego de simulación de acceso libre.</p>
          </div>

          <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 text-left shadow-md">
            
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diseños y Assets Gráficos</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Kenney Train Kit (v1.1)</p>
              <p className="text-xs text-slate-500 leading-normal">
                Todos los conceptos de los ferrocarriles y diseños están basados y atribuidos a Kenney (www.kenney.nl). Distribuido bajo la Licencia Creative Commons Zero (CC0 1.0 Universal).
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desarrollo Tecnológico</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">AI Coding Agent</p>
              <p className="text-xs text-slate-500 leading-normal">
                Creado en HTML5 con React, Tailwind CSS y dibujado dinámicamente en Canvas 2D de alta velocidad, ideal para un rendimiento impecable en Hostinger.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[10px] text-slate-400 font-bold">
              <HelpCircle className="h-4 w-4" /> No se requieren descargas adicionales ni APIs externas.
            </div>
          </div>

          <button
            onClick={() => { gameAudio.playClick(); setNavState('menu'); }}
            className="bg-slate-800 hover:bg-slate-900 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 py-2.5 px-6 rounded-xl font-bold text-sm active:scale-95 transition"
          >
            Volver al Menú
          </button>
        </div>
      )}

      {/* 4. ACTIVE PLAYING GAMEPLAY SCREEN */}
      {navState === 'playing' && (
        <div className="flex-1 flex flex-col xl:flex-row gap-5 p-4 sm:p-6 w-full max-w-7xl mx-auto" id="playing-dashboard">
          
          {/* LEFT AREA: MAP CANVAS PANEL */}
          <div className="flex-[5] flex flex-col gap-4">
            
            {/* IN-GAME HUD STATUS BAR */}
            <div className="grid grid-cols-5 gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-lg text-left transition-all">
              {/* Box 1: Money */}
              <div className="flex flex-col border-r border-slate-100 dark:border-slate-700/50 pr-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Tesoro</span>
                <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
                  ${money.toLocaleString()}
                </span>
              </div>

              {/* Box 2: Level */}
              <div className="flex flex-col border-r border-slate-100 dark:border-slate-700/50 pr-2 pl-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Red</span>
                <span className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 font-mono">
                  Lvl {level}
                </span>
              </div>

              {/* Box 3: Total Trains */}
              <div className="flex flex-col border-r border-slate-100 dark:border-slate-700/50 pr-2 pl-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Trenes</span>
                <span className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 font-mono">
                  {trains.length}
                </span>
              </div>

              {/* Box 4: Transported Passengers */}
              <div className="flex flex-col border-r border-slate-100 dark:border-slate-700/50 pr-2 pl-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Pasajeros</span>
                <span className="text-base sm:text-lg font-black text-sky-500 dark:text-sky-400 font-mono truncate">
                  {Math.round(stats.totalPassengersTransported)}
                </span>
              </div>

              {/* Box 5: Heavy Cargo */}
              <div className="flex flex-col pl-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Carga</span>
                <span className="text-base sm:text-lg font-black text-amber-500 dark:text-amber-400 font-mono truncate">
                  {Math.round(stats.totalCargoTransported)}t
                </span>
              </div>
            </div>

            {/* CORE GRAPHICAL INTERACTIVE CANVAS CONTAINER */}
            <div className="relative flex-1 min-h-[400px] sm:min-h-[480px]">
              <GameCanvas
                gameState={gameState}
                particles={particles}
                setParticles={setParticles}
                onUnlockStation={handleUnlockStation}
                onBuildLink={handleBuildLink}
                selectedTrain={selectedTrain}
                onSelectStation={setSelectedStation}
              />

              {/* STATION FLOATING MAP DETAIL OVERLAY */}
              {selectedStation && (
                <div 
                  className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-slide-up"
                  id="station-detail-overlay"
                >
                  <div className="text-left space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {selectedStation.id === 'centralia' ? '🏙️' : selectedStation.id === 'carbonia' ? '🪨' : selectedStation.id === 'silvia' ? '🌲' : selectedStation.id === 'toledo' ? '🌾' : '🏭'}
                      </span>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{selectedStation.name}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-400">
                        {selectedStation.type === 'city' ? 'Metrópolis' : 'Nodo Productor'}
                      </span>
                    </div>
                    <div className="flex gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                      <div>Produce: <span className="text-slate-700 dark:text-slate-300 font-semibold">{selectedStation.produces.map(p => CARGO_METADATA[p]?.name).join(', ') || 'Ninguno'}</span></div>
                      <div>Consume: <span className="text-slate-700 dark:text-slate-300 font-semibold">{selectedStation.consumes.map(p => CARGO_METADATA[p]?.name).join(', ') || 'Ninguno'}</span></div>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => { gameAudio.playClick(); setSelectedStation(null); }}
                      className="flex-1 sm:flex-none px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition"
                    >
                      Cerrar Detalle
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* EXIT BACK TO MENU BUTTON */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-medium text-slate-400 shadow-sm">
              <span>Auto-guardado activo ✔</span>
              <button
                onClick={() => {
                  gameAudio.playClick();
                  saveGame(gameState);
                  setNavState('menu');
                }}
                className="text-emerald-500 hover:text-emerald-600 font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                💾 Guardar y Salir al Menú
              </button>
            </div>

          </div>

          {/* RIGHT AREA: FULL CONTROL PANEL INTERFACE */}
          <div className="flex-[4] flex flex-col h-auto xl:h-[630px]">
            <GameUI
              gameState={gameState}
              selectedTrain={selectedTrain}
              onSelectTrain={setSelectedTrain}
              onBuyLocomotive={handleBuyLocomotive}
              onBuyCarriage={handleBuyCarriage}
              onRemoveCarriage={handleRemoveCarriage}
              onUpdateRoute={handleUpdateRoute}
              onUpgradeTech={handleUpgradeTech}
              onUnlockStation={handleUnlockStation}
              onResetGame={handleResetGame}
              setGameState={setGameState}
            />
          </div>

        </div>
      )}

      {/* 5. SPLASH SCREEN CELEBRATION LEVEL UP POPUP ALERT */}
      {showLevelUpAlert && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in" id="level-up-overlay">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-2xl p-6 text-center space-y-5 shadow-2xl relative overflow-hidden">
            
            {/* Sparkle details */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400" />

            <div className="h-16 w-16 bg-amber-100 dark:bg-amber-950/50 text-amber-500 rounded-2xl mx-auto flex items-center justify-center text-4xl">
              🏆
            </div>

            <div className="space-y-1">
              <span className="text-xs text-amber-500 font-black tracking-widest uppercase">¡Nivel Completado!</span>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">Nivel {unlockedLevel} Alcanzado</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal">
                ¡Tu empresa ferroviaria ha ampliado su cobertura y ascendido de nivel en la clasificación del gobierno!
              </p>
            </div>

            {/* Unlock indicators */}
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl text-left space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Nuevos Desbloqueos:</span>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-inside list-disc font-semibold">
                {unlockedLevel === 2 && (
                  <>
                    <li>Locomotoras **Diesel** ultrarrápidas.</li>
                    <li>Vagones de **Trigo** y exportación.</li>
                    <li>Acceso de desbloqueo para **Toledo**.</li>
                  </>
                )}
                {unlockedLevel === 3 && (
                  <>
                    <li>Locomotoras **Eléctricas de Alta Velocidad**.</li>
                    <li>Vagones industriales de **Acero pesado**.</li>
                    <li>Acceso de desbloqueo para **Zaragoza**.</li>
                  </>
                )}
                {unlockedLevel > 3 && (
                  <>
                    <li>Límites incrementados para todos los Upgrades.</li>
                    <li>Multiplicadores de ganancias de flete x{(1 + (unlockedLevel-1)*0.15).toFixed(2)}.</li>
                    <li>Potencia de tracción máxima ampliada en todas las locomotoras.</li>
                  </>
                )}
              </ul>
            </div>

            <button
              onClick={() => { gameAudio.playClick(); setShowLevelUpAlert(false); }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl active:scale-95 transition"
            >
              ¡Excelente, sigamos!
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
