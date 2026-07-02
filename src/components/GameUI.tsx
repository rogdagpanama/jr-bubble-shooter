/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameState, Train, Station, CargoType, RailwayLink, Upgrade } from '../game/types';
import { CARGO_METADATA } from '../game/station';
import { LOCOMOTIVE_SPEEDS, LOCOMOTIVE_COLORS, generateTrainName } from '../game/train';
import { getLocomotiveCost, CARRIAGE_COST, getUpgradeCost, getUpgradeMultiplier } from '../game/economy';
import { gameAudio } from '../game/audio';
import { 
  Train as TrainIcon, 
  Wrench, 
  Briefcase, 
  MapPin, 
  Plus, 
  Trash2, 
  TrendingUp, 
  ArrowRightLeft, 
  Fuel, 
  Gauge, 
  ShoppingBag, 
  Compass, 
  CheckCircle2, 
  Unlock, 
  Volume2, 
  VolumeX, 
  Sun, 
  Moon, 
  Maximize, 
  Info,
  Layers
} from 'lucide-react';

interface GameUIProps {
  gameState: GameState;
  selectedTrain: Train | null;
  onSelectTrain: (train: Train | null) => void;
  onBuyLocomotive: (type: 'steam' | 'diesel' | 'electric') => void;
  onBuyCarriage: (trainId: string, cargoType: CargoType) => void;
  onRemoveCarriage: (trainId: string, carriageId: string) => void;
  onUpdateRoute: (trainId: string, route: string[]) => void;
  onUpgradeTech: (category: 'speed' | 'capacity' | 'fuel') => void;
  onUnlockStation: (stationId: string) => void;
  onResetGame: () => void;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

export const GameUI: React.FC<GameUIProps> = ({
  gameState,
  selectedTrain,
  onSelectTrain,
  onBuyLocomotive,
  onBuyCarriage,
  onRemoveCarriage,
  onUpdateRoute,
  onUpgradeTech,
  onUnlockStation,
  onResetGame,
  setGameState
}) => {
  const [activeTab, setActiveTab] = useState<'trains' | 'upgrades' | 'network' | 'stats'>('trains');
  const [locoTypeSelect, setLocoTypeSelect] = useState<'steam' | 'diesel' | 'electric'>('steam');

  const { money, level, xp, xpToNextLevel, stations, links, trains, upgrades, stats } = gameState;

  // Active upgrades levels
  const speedLevel = upgrades.find(u => u.category === 'speed')?.level || 1;
  const capacityLevel = upgrades.find(u => u.category === 'capacity')?.level || 1;
  const fuelLevel = upgrades.find(u => u.category === 'fuel')?.level || 1;

  // Costs
  const nextLocoCost = getLocomotiveCost(trains.length);

  // Sound Controls
  const toggleSound = () => {
    const nextVolume = gameState.volume > 0 ? 0 : 0.5;
    gameAudio.setVolume(nextVolume);
    setGameState(prev => ({ ...prev, volume: nextVolume }));
    gameAudio.playClick();
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

  // Toggle Theme
  const toggleTheme = () => {
    gameAudio.playClick();
    setGameState(prev => ({ ...prev, isDarkMode: !prev.isDarkMode }));
  };

  // Sound horn of selected train
  const triggerHorn = () => {
    gameAudio.playHorn();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg" id="game-ui-root">
      
      {/* QUICK STATUS HEADER */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
        
        {/* Money, Level and XP Progress */}
        <div className="flex items-center gap-6">
          {/* Money Badge */}
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Tesoro</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              ${money.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Level Badge */}
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 h-10 w-10 rounded-xl flex items-center justify-center font-bold text-lg border border-amber-200/40">
              {level}
            </div>
            <div className="flex flex-col w-28 sm:w-36">
              <span className="text-xs text-slate-500 font-medium">Nivel de Red</span>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-1 relative">
                <div 
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (xp / xpToNextLevel) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                {Math.round(xp)} / {xpToNextLevel} XP
              </span>
            </div>
          </div>
        </div>

        {/* EPM and Train Count */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500 font-medium">Ingresos / Min</span>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              ${Math.round(stats.lastEPM)}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />

          {/* Quick settings toolbar */}
          <div className="flex items-center gap-1 bg-slate-200/50 dark:bg-slate-800/40 p-1 rounded-lg">
            <button 
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
              title="Alternar Tema Oscuro/Claro"
            >
              {gameState.isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
            </button>
            <button 
              onClick={toggleSound}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
              title="Alternar Sonido"
            >
              {gameState.volume > 0 ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-rose-500" />}
            </button>
            <button 
              onClick={toggleFullscreen}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
              title="Pantalla Completa"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex bg-slate-100 dark:bg-slate-950/60 p-1.5 border-b border-slate-200 dark:border-slate-800/60 font-display">
        <button
          onClick={() => { gameAudio.playClick(); setActiveTab('trains'); }}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'trains' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/20' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
          }`}
        >
          <TrainIcon className="h-4 w-4" />
          <span>Flota ({trains.length})</span>
        </button>
        <button
          onClick={() => { gameAudio.playClick(); setActiveTab('upgrades'); }}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'upgrades' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/20' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
          }`}
        >
          <Wrench className="h-4 w-4" />
          <span>Mejoras</span>
        </button>
        <button
          onClick={() => { gameAudio.playClick(); setActiveTab('network'); }}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'network' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/20' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
          }`}
        >
          <Compass className="h-4 w-4" />
          <span>Ciudades</span>
        </button>
        <button
          onClick={() => { gameAudio.playClick(); setActiveTab('stats'); }}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'stats' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/20' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          <span>Finanzas</span>
        </button>
      </div>

      {/* ACTIVE SCREEN CONTENT */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ maxHeight: '420px' }}>
        
        {/* TAB 1: TRAINS MANAGEMENT */}
        {activeTab === 'trains' && (
          <div className="space-y-4">
            
            {/* TRAIN ACQUISITION SHOP CONTAINER */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-200/70 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" /> Comprar Nueva Locomotora
                </h3>
                {nextLocoCost > 0 && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    Costo: ${nextLocoCost}
                  </span>
                )}
              </div>

              {level < 2 && (
                <div className="text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 p-2.5 rounded-lg flex items-start gap-1.5 border border-amber-200/40">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Sube a Nivel 2 para comprar trenes Diesel rápidos, y Nivel 3 para trenes Eléctricos.</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {/* Steam Engine button */}
                <button
                  disabled={money < nextLocoCost}
                  onClick={() => onBuyLocomotive('steam')}
                  className="flex flex-col items-center p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 dark:hover:border-emerald-400 disabled:opacity-50 disabled:hover:border-slate-200 transition text-center"
                >
                  <span className="text-xl">🚂</span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mt-1">Vapor</span>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">{LOCOMOTIVE_SPEEDS.steam} px/s</span>
                </button>

                {/* Diesel Engine button */}
                <button
                  disabled={level < 2 || money < nextLocoCost}
                  onClick={() => onBuyLocomotive('diesel')}
                  className="flex flex-col items-center p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 dark:hover:border-emerald-400 disabled:opacity-50 disabled:hover:border-slate-200 transition text-center relative overflow-hidden"
                >
                  {level < 2 && (
                    <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[0.5px] flex items-center justify-center">
                      <span className="text-[9px] bg-slate-800 text-white px-1 py-0.5 rounded font-black">Niv 2</span>
                    </div>
                  )}
                  <span className="text-xl">🚊</span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mt-1">Diesel</span>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">{LOCOMOTIVE_SPEEDS.diesel} px/s</span>
                </button>

                {/* Electric Engine button */}
                <button
                  disabled={level < 3 || money < nextLocoCost}
                  onClick={() => onBuyLocomotive('electric')}
                  className="flex flex-col items-center p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 dark:hover:border-emerald-400 disabled:opacity-50 disabled:hover:border-slate-200 transition text-center relative overflow-hidden"
                >
                  {level < 3 && (
                    <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[0.5px] flex items-center justify-center">
                      <span className="text-[9px] bg-slate-800 text-white px-1 py-0.5 rounded font-black">Niv 3</span>
                    </div>
                  )}
                  <span className="text-xl">🚄</span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mt-1">Bala</span>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">{LOCOMOTIVE_SPEEDS.electric} px/s</span>
                </button>
              </div>
            </div>

            {/* TRAIN FLEET LIST */}
            {trains.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <span className="text-3xl">📭</span>
                <p className="text-sm font-medium">No posees trenes activos en tu flota.</p>
                <p className="text-xs text-slate-500">¡Compra una locomotora de vapor arriba para comenzar!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tus Trenes ({trains.length})</h3>
                
                {trains.map(train => {
                  const isTrainSelected = selectedTrain?.id === train.id;
                  
                  // Get stops details
                  const stopsNames = train.currentRoute.map(stationId => {
                    return stations.find(s => s.id === stationId)?.name.split(' ')[1] || stationId;
                  }).join(' ➔ ');

                  return (
                    <div 
                      key={train.id}
                      onClick={() => { gameAudio.playClick(); onSelectTrain(train); }}
                      className={`p-3.5 rounded-xl border transition cursor-pointer text-left relative overflow-hidden ${
                        isTrainSelected 
                          ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm' 
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* Active status bar colored by engine type */}
                      <div 
                        className="absolute top-0 left-0 bottom-0 w-1" 
                        style={{ backgroundColor: LOCOMOTIVE_COLORS[train.locomotiveType] }}
                      />

                      <div className="pl-2 space-y-2">
                        {/* Name, Type & status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{train.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-500 dark:text-slate-400">
                              {train.locomotiveType === 'steam' ? 'Vapor' : train.locomotiveType === 'diesel' ? 'Diesel' : 'Bala'}
                            </span>
                          </div>
                          
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            train.status === 'moving' 
                              ? 'bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300' 
                              : train.status === 'loading' 
                              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 animate-pulse' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            {train.status === 'moving' ? 'En viaje' : train.status === 'loading' ? 'Cargando' : 'Sin Vías'}
                          </span>
                        </div>

                        {/* Route Path */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate font-semibold">{stopsNames || 'Sin ruta definida'}</span>
                        </div>

                        {/* Carriages capacity display */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Vagones:</span>
                          {train.carriages.length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">Ninguno</span>
                          ) : (
                            train.carriages.map(c => {
                              const meta = CARGO_METADATA[c.type];
                              return (
                                <div 
                                  key={c.id} 
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-200/40 dark:border-slate-800/60"
                                  style={{ backgroundColor: meta?.color + '20', color: meta?.color }}
                                >
                                  <span>
                                    {c.type === CargoType.PASSENGER ? '👤' : c.type === CargoType.COAL ? '🪨' : c.type === CargoType.WOOD ? '🌲' : c.type === CargoType.WHEAT ? '🌾' : '🏭'}
                                  </span>
                                  <span>{c.currentAmount}/{c.capacity}</span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* EXPANDED CONTROLS FOR SELECTED TRAIN */}
                        {isTrainSelected && (
                          <div 
                            className="pt-3 border-t border-slate-200/50 dark:border-slate-800 mt-2 space-y-3.5"
                            onClick={(e) => e.stopPropagation()} // don't toggle select off
                          >
                            
                            {/* Whistle Horn */}
                            <button
                              onClick={triggerHorn}
                              className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                              🔔 ¡Tocar Bocina! (Choo Choo!)
                            </button>

                            {/* Buy carriage tool */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">Acoplar Nuevo Vagón (${CARRIAGE_COST})</span>
                                <span className="text-[10px] text-slate-400">Capacidad: {getUpgradeMultiplier('capacity', capacityLevel)}</span>
                              </div>
                              <div className="grid grid-cols-5 gap-1">
                                {Object.values(CargoType).map(type => {
                                  const metadata = CARGO_METADATA[type];
                                  const emoji = type === CargoType.PASSENGER ? '👤' : type === CargoType.COAL ? '🪨' : type === CargoType.WOOD ? '🌲' : type === CargoType.WHEAT ? '🌾' : '🏭';
                                  
                                  const canAfford = money >= CARRIAGE_COST;

                                  // Locked check for steel/wheat depending on level
                                  const isLockedByLevel = (type === CargoType.WHEAT && level < 2) || (type === CargoType.STEEL && level < 3);

                                  return (
                                    <button
                                      key={type}
                                      disabled={!canAfford || isLockedByLevel}
                                      onClick={() => onBuyCarriage(train.id, type)}
                                      className="py-2 px-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center hover:border-emerald-500 dark:hover:border-emerald-400 disabled:opacity-40 transition relative overflow-hidden"
                                      title={`Añadir vagón de ${metadata?.name}`}
                                    >
                                      {isLockedByLevel && (
                                        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[0.5px] flex items-center justify-center text-[8px] font-black text-white">
                                          🔒
                                        </div>
                                      )}
                                      <span className="text-base">{emoji}</span>
                                      <span className="text-[8px] font-bold text-slate-600 dark:text-slate-400 truncate w-full text-center mt-0.5">{metadata?.name.split(' ')[0]}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* ROUTING CONTROLLER EDITOR */}
                            <div className="space-y-2">
                              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-slate-400" /> Planificar Itinerario de Paradas
                              </span>
                              <p className="text-[10px] text-slate-400 leading-tight">Activa las estaciones deseadas. El tren viajará de forma automática y cíclica en ese orden.</p>
                              
                              <div className="flex flex-wrap gap-1.5">
                                {stations.map(st => {
                                  if (!st.isUnlocked) return null;
                                  
                                  const isChecked = train.currentRoute.includes(st.id);
                                  
                                  const toggleStation = () => {
                                    gameAudio.playClick();
                                    let nextRoute = [...train.currentRoute];
                                    if (isChecked) {
                                      // Remove stop, but ensure at least 1 remains to avoid null states
                                      nextRoute = nextRoute.filter(id => id !== st.id);
                                    } else {
                                      nextRoute.push(st.id);
                                    }
                                    onUpdateRoute(train.id, nextRoute);
                                  };

                                  return (
                                    <button
                                      key={st.id}
                                      onClick={toggleStation}
                                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition ${
                                        isChecked
                                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                      }`}
                                    >
                                      <span>{st.name.split(' ').slice(1).join(' ')}</span>
                                      {isChecked ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Plus className="h-3 w-3 text-slate-400" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* REMOVE / SELL TRAIN CARS (Individually) */}
                            {train.carriages.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-rose-500 uppercase">Desacoplar Vagones:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {train.carriages.map((c, idx) => {
                                    const meta = CARGO_METADATA[c.type];
                                    return (
                                      <button
                                        key={c.id}
                                        onClick={() => onRemoveCarriage(train.id, c.id)}
                                        className="text-[9px] bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition border border-rose-100/30"
                                        title="Eliminar este vagón"
                                      >
                                        <span>Vagón #{idx+1} ({meta?.name.slice(0, 4)})</span>
                                        <Trash2 className="h-3 w-3 text-rose-500 shrink-0" />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TECH UPGRADES SHOP */}
        {activeTab === 'upgrades' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mejoras de Tecnología de Red</h3>
            
            <div className="grid grid-cols-1 gap-3">
              {upgrades.map(upgrade => {
                const currentLevel = upgrade.level;
                const cost = getUpgradeCost(upgrade.category, currentLevel);
                const isMax = currentLevel >= upgrade.maxLevel;

                const canBuy = money >= cost && !isMax;

                // Multipliers representations
                let upgradeValueText = '';
                if (upgrade.category === 'speed') {
                  upgradeValueText = `x${getUpgradeMultiplier('speed', currentLevel).toFixed(2)} Vel`;
                } else if (upgrade.category === 'capacity') {
                  upgradeValueText = `${getUpgradeMultiplier('capacity', currentLevel)} Ton/Car`;
                } else {
                  upgradeValueText = `x${getUpgradeMultiplier('fuel', currentLevel).toFixed(2)} Gasto`;
                }

                // Next level multiplier preview
                let nextValueText = '';
                if (!isMax) {
                  if (upgrade.category === 'speed') {
                    nextValueText = `➔ x${getUpgradeMultiplier('speed', currentLevel + 1).toFixed(2)}`;
                  } else if (upgrade.category === 'capacity') {
                    nextValueText = `➔ ${getUpgradeMultiplier('capacity', currentLevel + 1)}`;
                  } else {
                    nextValueText = `➔ x${getUpgradeMultiplier('fuel', currentLevel + 1).toFixed(2)}`;
                  }
                }

                return (
                  <div 
                    key={upgrade.id}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 text-left shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{upgrade.name}</span>
                        <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded-md font-bold">
                          Lvl {currentLevel}/{upgrade.maxLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{upgrade.description}</p>
                      
                      {/* Current & Next values */}
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 font-semibold">
                        {upgrade.category === 'speed' ? <Gauge className="h-3 w-3" /> : upgrade.category === 'capacity' ? <Layers className="h-3 w-3" /> : <Fuel className="h-3 w-3" />}
                        <span className="text-slate-700 dark:text-slate-300">{upgradeValueText}</span>
                        <span className="text-emerald-500 font-bold">{nextValueText}</span>
                      </div>
                    </div>

                    <button
                      disabled={!canBuy}
                      onClick={() => onUpgradeTech(upgrade.category)}
                      className={`py-2 px-3.5 rounded-lg text-xs font-bold font-mono transition flex flex-col items-center justify-center shrink-0 min-w-24 ${
                        isMax 
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : canBuy
                          ? 'bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/10'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200/50 dark:border-slate-800'
                      }`}
                    >
                      {isMax ? (
                        <span>MÁXIMO</span>
                      ) : (
                        <>
                          <span className="text-[10px] uppercase font-sans font-semibold tracking-wider text-emerald-100/80">Mejorar</span>
                          <span className="text-sm font-black mt-0.5">${cost}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: NETWORK CITIES */}
        {activeTab === 'network' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Desbloquear Ciudades de la Red</h3>
            
            <div className="grid grid-cols-1 gap-3">
              {stations.map(st => {
                const canUnlock = level >= st.levelRequired && money >= st.costToUnlock;

                return (
                  <div 
                    key={st.id}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 text-left shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: st.color }}
                        />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{st.name}</span>
                        {st.isUnlocked ? (
                          <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Desbloqueada</span>
                        ) : (
                          <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Bloqueada</span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                        {st.id === 'centralia' && 'Metrópolis principal que consume todos los recursos industriales y genera oleadas continuas de pasajeros.'}
                        {st.id === 'carbonia' && 'Centro minero montañoso que produce toneladas de Carbón listas para ser transportadas a Centralia.'}
                        {st.id === 'silvia' && 'Denso bosque forestal que produce cargamentos de Madera de alta resistencia.'}
                        {st.id === 'toledo' && 'Ciudad industrializada. Desbloquea la producción de Trigo y consume Madera y Acero para expandirse.'}
                        {st.id === 'zaragoza' && 'Gran centro fabril. Produce Acero para puentes y locomotoras pesadas, y consume Carbón y Trigo.'}
                      </p>

                      <div className="flex gap-4 text-[10px] text-slate-400 font-semibold font-mono">
                        <div>Produce: <span className="text-slate-700 dark:text-slate-300">{st.produces.map(p => CARGO_METADATA[p]?.name).join(', ') || 'Nada'}</span></div>
                        <div>Consume: <span className="text-slate-700 dark:text-slate-300">{st.consumes.map(p => CARGO_METADATA[p]?.name).join(', ') || 'Nada'}</span></div>
                      </div>
                    </div>

                    {!st.isUnlocked && (
                      <button
                        disabled={!canUnlock}
                        onClick={() => onUnlockStation(st.id)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold font-mono min-w-24 flex flex-col items-center justify-center shrink-0 transition ${
                          canUnlock
                            ? 'bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200/50 dark:border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        {level < st.levelRequired ? (
                          <>
                            <span className="text-[9px] text-rose-500 uppercase font-sans">Requiere</span>
                            <span className="text-sm font-black text-rose-500">Nivel {st.levelRequired}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] uppercase font-sans text-emerald-100/80">Comprar</span>
                            <span className="text-sm font-black mt-0.5">${st.costToUnlock}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: GENERAL STATISTICS */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Reporte de Auditoría de Ferrocarriles</h3>
            
            <div className="grid grid-cols-2 gap-3.5">
              
              {/* Stat Card: Revenue */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/10 border border-slate-200/50 dark:border-slate-800 rounded-xl space-y-1 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ingresos Históricos</span>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">${Math.round(stats.totalEarned).toLocaleString()}</p>
                <span className="text-[9px] text-slate-400">Total acumulado de fletes</span>
              </div>

              {/* Stat Card: Trains */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/10 border border-slate-200/50 dark:border-slate-800 rounded-xl space-y-1 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Flota Activa</span>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{trains.length} Trenes</p>
                <span className="text-[9px] text-slate-400">Locomotoras activas</span>
              </div>

              {/* Stat Card: Passengers */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/10 border border-slate-200/50 dark:border-slate-800 rounded-xl space-y-1 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Pasajeros Transportados</span>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{Math.round(stats.totalPassengersTransported)} Pax</p>
                <span className="text-[9px] text-slate-400">Ingreso por larga distancia</span>
              </div>

              {/* Stat Card: Cargo */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/10 border border-slate-200/50 dark:border-slate-800 rounded-xl space-y-1 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Carga Industrial</span>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{Math.round(stats.totalCargoTransported)} Ton</p>
                <span className="text-[9px] text-slate-400">Carbón, madera, trigo y acero</span>
              </div>
            </div>

            {/* RESET PROGRESS ZONE */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-left space-y-2">
              <span className="text-xs font-bold text-rose-500 uppercase">Acciones Administrativas</span>
              <p className="text-xs text-slate-400">Si deseas borrar tu guardado de la base local e iniciar una nueva empresa ferroviaria de cero:</p>
              
              <button
                onClick={() => {
                  if (confirm('¿Seguro que deseas reiniciar el juego? Se perderá todo tu progreso.')) {
                    gameAudio.playClick();
                    onResetGame();
                  }
                }}
                className="bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition border border-rose-100/20"
              >
                <Trash2 className="h-4 w-4" /> Reiniciar Empresa (Borrar Datos)
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
