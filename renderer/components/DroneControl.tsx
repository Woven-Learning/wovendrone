import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUp, ArrowDown, RotateCcw, RotateCw } from 'lucide-react';

export interface DroneState {
  connected: boolean;
  connecting: boolean;
}

interface JoystickState {
  x: number;
  y: number;
}

interface DroneCommand {
  thrust: number;
  roll: number;
  pitch: number;
  yaw: number;
}

const DroneControl: React.FC = () => {
  const [droneState, setDroneState] = useState<DroneState>({
    connected: false,
    connecting: false
  });

  const [leftJoystick, setLeftJoystick] = useState<JoystickState>({ x: 0, y: 0 });
  const [rightJoystick, setRightJoystick] = useState<JoystickState>({ x: 0, y: 0 });
  
  // Add state for smooth control transitions
  const [controlState, setControlState] = useState({
    thrust: 0,
    yaw: 0,
    pitch: 0,
    roll: 0
  });

  // Track pressed keys
  const [pressedKeys, setPressedKeys] = useState(new Set<string>());

  // Constants for smooth control
  const CONTROL_STEP = 0.05;        // 5% increase per frame when key pressed
  const CONTROL_DECAY = 0.95;       // 5% decay per frame when released
  const CONTROL_THRESHOLD = 0.01;   // 1% threshold for zero
  const MAX_CONTROL = 1.0;          // Maximum control value

  // WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);

  const COMMAND_INTERVAL = 50; // Send commands every 50ms like iOS app
  const MAX_THRUST = 65535;
  const DEFAULT_PITCH_RATE = 30; // degrees
  const DEFAULT_YAW_RATE = 200; // degrees/second
  const DEFAULT_MAX_THRUST = 80; // percentage
  const LINEAR_THRUST = true; // Match iOS app thrust mode
  const LINEAR_PR = true; // Match iOS app pitch/roll mode

  const [thrustActive, setThrustActive] = useState(false);

  // Helper functions to match iOS app control logic
  const calculateThrust = (control: number): number => {
    // Convert to percentage (0-100) and apply threshold
    const thrust = control > 0 ? Math.min(control * 100, 100) : 0;
    return Math.abs(thrust) < CONTROL_THRESHOLD ? 0 : thrust;
  };

  const calculateRoll = (control: number): number => {
    // Convert to degrees (-30 to 30) and apply threshold
    const roll = control * DEFAULT_PITCH_RATE;
    return Math.abs(roll) < CONTROL_THRESHOLD ? 0 : roll;
  };

  const calculatePitch = (control: number): number => {
    // Convert to degrees (-30 to 30) and apply threshold
    const pitch = control * DEFAULT_PITCH_RATE;
    return Math.abs(pitch) < CONTROL_THRESHOLD ? 0 : pitch;
  };

  const calculateYaw = (control: number): number => {
    // Convert to degrees/sec (-180 to 180) and apply threshold
    const yaw = control * DEFAULT_YAW_RATE;
    return Math.abs(yaw) < CONTROL_THRESHOLD ? 0 : yaw;
  };

  const roundToThreshold = (value: number): number => {
    return Math.abs(value) < CONTROL_THRESHOLD ? 0 : value;
  };

  const sendControlCommand = useCallback((command: DroneCommand) => {
    // Round very small values to 0
    const roundedCommand = {
      thrust: roundToThreshold(command.thrust),
      roll: roundToThreshold(command.roll),
      pitch: roundToThreshold(command.pitch),
      yaw: roundToThreshold(command.yaw)
    };

    // Check if this is a stop command (all zeros or just thrust is zero)
    const isStopCommand = roundedCommand.thrust === 0 && 
                         roundedCommand.roll === 0 && 
                         roundedCommand.pitch === 0 && 
                         roundedCommand.yaw === 0;

    // Only send if values have changed or it's a stop command
    if (isStopCommand || 
        (roundedCommand.thrust !== lastSentValues.current.thrust ||
         roundedCommand.roll !== lastSentValues.current.roll ||
         roundedCommand.pitch !== lastSentValues.current.pitch ||
         roundedCommand.yaw !== lastSentValues.current.yaw)) {
      
      // Ensure thrust is within 0-100 range
      roundedCommand.thrust = Math.max(0, Math.min(100, roundedCommand.thrust));
      
      // Update last sent values with rounded values
      lastSentValues.current = { ...roundedCommand };
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket sending command:', roundedCommand, isStopCommand ? '(emergency stop)' : '');
        wsRef.current.send(JSON.stringify({
          type: 'command',
          command: roundedCommand,
          // Use emergency mode for stop commands to ensure they're processed immediately
          queueMode: isStopCommand ? 'flush' : 'normal'
        }));
      }
    }
  }, []);

  // Keep track of last sent values
  const lastSentValues = useRef({
    thrust: 0,
    roll: 0,
    pitch: 0,
    yaw: 0
  });

  // Connect to WebSocket server
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
      // Request drone connection
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
      connectToDrone();  // First establish the WebSocket connection
    } else {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'disconnect' }));
        wsRef.current.close();
      }
    }
  };

  // Animation frame for smooth controls
  useEffect(() => {
    let animationFrameId: number;

    const updateControls = () => {
      setControlState(prev => {
        const next = { ...prev };

        // Thrust (Vertical movement)
        if (pressedKeys.has('w')) {
          // Gradual increase
          next.thrust = Math.min(next.thrust + CONTROL_STEP * (1.0 - next.thrust), MAX_CONTROL);
        } else if (pressedKeys.has('s')) {
          // Gradual decrease
          next.thrust = Math.max(0, next.thrust - CONTROL_STEP * (next.thrust));
        } else {
          // Smooth decay
          next.thrust = next.thrust * CONTROL_DECAY;
          if (Math.abs(next.thrust) < CONTROL_THRESHOLD) next.thrust = 0;
        }

        // Yaw (Rotation)
        if (pressedKeys.has('a')) {
          // Gradual increase to max left rotation
          next.yaw = Math.max(next.yaw - CONTROL_STEP * (1.0 + next.yaw), -MAX_CONTROL);
        } else if (pressedKeys.has('d')) {
          // Gradual increase to max right rotation
          next.yaw = Math.min(next.yaw + CONTROL_STEP * (1.0 - next.yaw), MAX_CONTROL);
        } else {
          // Return to center with smooth decay
          next.yaw = next.yaw * CONTROL_DECAY;
          if (Math.abs(next.yaw) < CONTROL_THRESHOLD) next.yaw = 0;
        }

        // Pitch (Forward/Backward tilt)
        if (pressedKeys.has('ArrowUp')) {
          // Gradual increase to max forward tilt
          next.pitch = Math.max(next.pitch - CONTROL_STEP * (1.0 + next.pitch), -MAX_CONTROL);
        } else if (pressedKeys.has('ArrowDown')) {
          // Gradual increase to max backward tilt
          next.pitch = Math.min(next.pitch + CONTROL_STEP * (1.0 - next.pitch), MAX_CONTROL);
        } else {
          // Return to level with smooth decay
          next.pitch = next.pitch * CONTROL_DECAY;
          if (Math.abs(next.pitch) < CONTROL_THRESHOLD) next.pitch = 0;
        }

        // Roll (Left/Right tilt)
        if (pressedKeys.has('ArrowLeft')) {
          // Gradual increase to max left tilt
          next.roll = Math.max(next.roll - CONTROL_STEP * (1.0 + next.roll), -MAX_CONTROL);
        } else if (pressedKeys.has('ArrowRight')) {
          // Gradual increase to max right tilt
          next.roll = Math.min(next.roll + CONTROL_STEP * (1.0 - next.roll), MAX_CONTROL);
        } else {
          // Return to level with smooth decay
          next.roll = next.roll * CONTROL_DECAY;
          if (Math.abs(next.roll) < CONTROL_THRESHOLD) next.roll = 0;
        }

        return next;
      });

      animationFrameId = requestAnimationFrame(updateControls);
    };

    animationFrameId = requestAnimationFrame(updateControls);
    return () => cancelAnimationFrame(animationFrameId);
  }, [pressedKeys]);

  // Send commands whenever control state changes
  useEffect(() => {
    if (!droneState.connected) return;

    const command = {
      thrust: calculateThrust(controlState.thrust),
      roll: calculateRoll(controlState.roll),
      pitch: calculatePitch(controlState.pitch),
      yaw: calculateYaw(controlState.yaw)
    };

    sendControlCommand(command);
  }, [controlState, droneState.connected, sendControlCommand]);

  // Handle keyboard controls
  useEffect(() => {
    if (!droneState.connected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.repeat) { // Prevent key repeat
        setPressedKeys(prev => new Set(prev).add(e.key));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.delete(e.key);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [droneState.connected]);

  // Update joystick positions based on control state
  useEffect(() => {
    setLeftJoystick({
      x: controlState.yaw,
      y: controlState.thrust
    });

    setRightJoystick({
      x: controlState.roll,
      y: controlState.pitch
    });
  }, [controlState]);

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-2 text-gray-300">Left Controls (WASD)</h3>
            <ul className="space-y-2 text-gray-400">
              <li><span className="font-mono bg-gray-800 px-2 py-1 rounded text-white">W</span> - Increase Thrust</li>
              <li><span className="font-mono bg-gray-800 px-2 py-1 rounded text-white">S</span> - Decrease Thrust</li>
              <li><span className="font-mono bg-gray-800 px-2 py-1 rounded text-white">A</span> - Yaw Left</li>
              <li><span className="font-mono bg-gray-800 px-2 py-1 rounded text-white">D</span> - Yaw Right</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2 text-gray-300">Right Controls (Arrow Keys)</h3>
            <ul className="space-y-2 text-gray-400">
              <li><span className="font-mono bg-gray-800 px-2 py-1 rounded text-white">↑</span> - Pitch Forward</li>
              <li><span className="font-mono bg-gray-800 px-2 py-1 rounded text-white">↓</span> - Pitch Backward</li>
              <li><span className="font-mono bg-gray-800 px-2 py-1 rounded text-white">←</span> - Roll Left</li>
              <li><span className="font-mono bg-gray-800 px-2 py-1 rounded text-white">→</span> - Roll Right</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Real-time Data Display */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-white">Drone Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <h3 className="text-sm text-gray-400">Thrust</h3>
            <p className="text-2xl font-mono text-white">{(controlState.thrust * 100).toFixed(1)}%</p>
          </div>
          <div>
            <h3 className="text-sm text-gray-400">Yaw</h3>
            <p className="text-2xl font-mono text-white">{(controlState.yaw * DEFAULT_YAW_RATE).toFixed(1)}°/s</p>
          </div>
          <div>
            <h3 className="text-sm text-gray-400">Pitch</h3>
            <p className="text-2xl font-mono text-white">{(controlState.pitch * DEFAULT_PITCH_RATE).toFixed(1)}°</p>
          </div>
          <div>
            <h3 className="text-sm text-gray-400">Roll</h3>
            <p className="text-2xl font-mono text-white">{(controlState.roll * DEFAULT_PITCH_RATE).toFixed(1)}°</p>
          </div>
        </div>
      </div>

      {/* Connection Status and Controls */}
      {/* <div className="flex justify-center">
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
      </div> */}
    </div>
  );
};

export default DroneControl;
