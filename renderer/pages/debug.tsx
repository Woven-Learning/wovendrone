import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { DroneState } from '../components/DroneControl';

interface DroneCommand {
  thrust: number;
  roll: number;
  pitch: number;
  yaw: number;
}

export default function Debug() {
  const [droneState, setDroneState] = useState<DroneState>({
    connected: false,
    connecting: false
  });

  // WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);

  // Command state
  const [throttle, setThrottle] = useState(80);
  const [duration, setDuration] = useState(1);
  const [isCommandActive, setIsCommandActive] = useState(false);
  const commandTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Constants from DroneControl
  const CONTROL_DECAY = 0.80; // Changed from 0.95 to 0.80 for faster decay
  const CONTROL_THRESHOLD = 0.1; // Changed from 0.01 to 0.1 to stop sooner

  // Add new state for takeoff-hover sequence
  const [takeoffThrust, setTakeoffThrust] = useState(80);
  const [hoverThrust, setHoverThrust] = useState(50);
  const [takeoffDuration, setTakeoffDuration] = useState(500);
  const [hoverDuration, setHoverDuration] = useState(2000);
  const [isSequenceActive, setIsSequenceActive] = useState(false);

  const connectToDrone = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Already connected to WebSocket');
      return;
    }

    setDroneState(prev => ({ ...prev, connecting: true }));
    console.log('Attempting to connect to WebSocket...');

    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection opened');
      ws.send(JSON.stringify({ type: 'connect' }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket received:', data);
      if (data.type === 'connection_status') {
        setDroneState({
          connected: data.connected,
          connecting: false
        });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setDroneState({
        connected: false,
        connecting: false
      });
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setDroneState({
        connected: false,
        connecting: false
      });
    };
  }, []);

  const handleConnectClick = () => {
    if (!droneState.connected) {
      connectToDrone();
    } else {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'disconnect' }));
        wsRef.current.close();
      }
    }
  };

  const sendCommand = useCallback((command: DroneCommand) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket sending command:', command);
      wsRef.current.send(JSON.stringify({
        type: 'command',
        command
      }));
    }
  }, []);

  const startDecaySequence = useCallback(() => {
    let currentThrust = throttle;
    
    const decayInterval = setInterval(() => {
      currentThrust = currentThrust * CONTROL_DECAY;
      
      if (currentThrust < CONTROL_THRESHOLD) {
        clearInterval(decayInterval);
        sendCommand({ thrust: 0, roll: 0, pitch: 0, yaw: 0 });
        setIsCommandActive(false);
        return;
      }
      
      sendCommand({
        thrust: currentThrust,
        roll: 0,
        pitch: 0,
        yaw: 0
      });
    }, 100); // Update every 50ms like in DroneControl

    return () => clearInterval(decayInterval);
  }, [throttle, sendCommand]);

  const handleTakeoff = () => {
    if (!droneState.connected || isCommandActive) return;

    setIsCommandActive(true);
    
    // Send initial command
    sendCommand({
      thrust: throttle,
      roll: 0,
      pitch: 0,
      yaw: 0
    });

    // Set timeout to start decay sequence
    commandTimeoutRef.current = setTimeout(() => {
      startDecaySequence();
    }, duration * 1000);
  };

  const handleTakeoffHover = () => {
    if (!droneState.connected || isCommandActive || isSequenceActive) return;

    setIsSequenceActive(true);
    
    // Step 1: Takeoff
    sendCommand({
      thrust: takeoffThrust,
      roll: 0,
      pitch: 0,
      yaw: 0
    });

    // Step 2: Switch to hover after takeoff duration
    const hoverTimeout = setTimeout(() => {
      sendCommand({
        thrust: hoverThrust,
        roll: 0,
        pitch: 0,
        yaw: 0
      });

      // Step 3: Start decay sequence after hover duration
      const decayTimeout = setTimeout(() => {
        startDecaySequence();
        setIsSequenceActive(false);
      }, hoverDuration);

      commandTimeoutRef.current = decayTimeout;
    }, takeoffDuration);

    commandTimeoutRef.current = hoverTimeout;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link 
            href="/home"
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-2">Setup Checklist</h1>
        <p className="text-gray-400 text-lg">
          Use this screen to calibrate and balance your drone for optimum flight performance. 
          The current default thrust settings should be good, but you can adjust as needed. Click the Connect button to begin.
        </p>
      </div>

      {/* Connection Button */}
      <div className="mb-6">
        <button
          onClick={handleConnectClick}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors duration-200 ${
            droneState.connected
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {droneState.connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Command Configuration */}
      {/* <div className="bg-gray-900 p-6 rounded-lg shadow-sm space-y-4">
        <h2 className="text-xl font-semibold text-white mb-4">Takeoff Command</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">
              Throttle (0-100%)
              <input
                type="number"
                min="0"
                max="100"
                value={throttle}
                onChange={(e) => setThrottle(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
              />
            </label>
          </div>
          
          <div>
            <label className="block text-gray-300 mb-2">
              Duration (seconds)
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={duration}
                onChange={(e) => setDuration(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
              />
            </label>
          </div>

          <button
            onClick={handleTakeoff}
            disabled={!droneState.connected || isCommandActive}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors duration-200 w-full
              ${!droneState.connected || isCommandActive
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'} text-white`}
          >
            {isCommandActive ? 'Command Running...' : 'Execute Takeoff'}
          </button>
        </div>
      </div> */}

      {/* Takeoff and Hover Sequence */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-sm space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-white mb-4">Takeoff and Hover Sequence</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 mb-2">
              Takeoff Thrust ({takeoffThrust}%)
              <input
                type="range"
                min="0"
                max="100"
                value={takeoffThrust}
                onChange={(e) => setTakeoffThrust(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2"
              />
            </label>
          </div>
          
          <div>
            <label className="block text-gray-300 mb-2">
              Hover Thrust ({hoverThrust}%)
              <input
                type="range"
                min="0"
                max="100"
                value={hoverThrust}
                onChange={(e) => setHoverThrust(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2"
              />
            </label>
          </div>

          <div>
            <label className="block text-gray-300 mb-2">
              Takeoff Duration ({takeoffDuration}ms)
              <input
                type="number"
                min="100"
                step="100"
                value={takeoffDuration}
                onChange={(e) => setTakeoffDuration(Math.max(100, parseInt(e.target.value) || 100))}
                className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
              />
            </label>
          </div>

          <div>
            <label className="block text-gray-300 mb-2">
              Hover Duration ({hoverDuration}ms)
              <input
                type="number"
                min="100"
                step="100"
                value={hoverDuration}
                onChange={(e) => setHoverDuration(Math.max(100, parseInt(e.target.value) || 100))}
                className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
              />
            </label>
          </div>
        </div>

        <button
          onClick={handleTakeoffHover}
          disabled={!droneState.connected || isCommandActive || isSequenceActive}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors duration-200 w-full
            ${!droneState.connected || isCommandActive || isSequenceActive
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'} text-white mt-4`}
        >
          {isSequenceActive ? 'Sequence Running...' : 'Run Takeoff-Hover Sequence'}
        </button>
      </div>

      {/* Command Status */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-white mb-4">Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm text-gray-400">Connection</h3>
            <p className="text-xl font-mono text-white">
              {droneState.connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div>
            <h3 className="text-sm text-gray-400">Command State</h3>
            <p className="text-xl font-mono text-white">
              {isCommandActive ? 'Running' : 'Ready'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
