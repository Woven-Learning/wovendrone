import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ChevronDown, 
  ChevronUp, 
  Play, 
  Plus, 
  Trash,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Plane,
  PlaneLanding,
  Home
} from 'lucide-react';

interface DroneCommand {
  thrust: number;
  roll: number;
  pitch: number;
  yaw: number;
}

interface CommandConfig {
  name: string;
  duration: number;
  command: DroneCommand;
  isSpecial?: boolean;
  advanced?: {
    thrust: number;
    pitch?: number;
    yaw?: number;
  };
}

const DEFAULT_COMMANDS: CommandConfig[] = [
  {
    name: 'Take Off',
    duration: 500,
    isSpecial: true,
    command: { thrust: 75, roll: 0, pitch: 0, yaw: 0 },
    advanced: { thrust: 75 }
  },
  {
    name: 'Move Forward',
    duration: 1000,
    command: { thrust: 60, roll: 0, pitch: -10, yaw: 0 },
    advanced: { thrust: 60, pitch: -10 }
  },
  {
    name: 'Move Backward',
    duration: 1000,
    command: { thrust: 60, roll: 0, pitch: 10, yaw: 0 },
    advanced: { thrust: 60, pitch: 10 }
  },
  {
    name: 'Rotate Left',
    duration: 1000,
    command: { thrust: 60, roll: 0, pitch: 0, yaw: -20 },
    advanced: { thrust: 60, yaw: -20 }
  },
  {
    name: 'Rotate Right',
    duration: 1000,
    command: { thrust: 60, roll: 0, pitch: 0, yaw: 20 },
    advanced: { thrust: 60, yaw: 20 }
  },
  {
    name: 'Land',
    duration: 2000,
    isSpecial: true,
    command: { thrust: 0, roll: 0, pitch: 0, yaw: 0 }
  }
];

const CommandIcons: Record<string, React.ReactNode> = {
  'Take Off': <Plane className="w-5 h-5" />,
  'Move Forward': <ArrowUp className="w-5 h-5" />,
  'Move Backward': <ArrowDown className="w-5 h-5" />,
  'Rotate Left': <RotateCcw className="w-5 h-5" />,
  'Rotate Right': <RotateCw className="w-5 h-5" />,
  'Land': <PlaneLanding className="w-5 h-5" />
};

const Program: React.FC = () => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [program, setProgram] = useState<CommandConfig[]>([
    DEFAULT_COMMANDS[0], // Take Off
    DEFAULT_COMMANDS[DEFAULT_COMMANDS.length - 1] // Land
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  
  // Track last sent command values (similar to manual mode)
  const lastSentValues = useRef({
    thrust: 0,
    roll: 0,
    pitch: 0,
    yaw: 0
  });
  
  // Constants for control - with higher threshold to ensure values go to zero
  const CONTROL_THRESHOLD = 5.0; // Increased threshold to ensure small values go to zero
  const COMMAND_INTERVAL = 50; // Send commands every 50ms
  
  // Connect to WebSocket server
  const connectToDrone = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      return;
    }

    setConnecting(true);
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
        setConnected(data.connected);
        setConnecting(false);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setConnected(false);
      setConnecting(false);
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
      setConnecting(false);
      wsRef.current = null;
    };
  }, []);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Round small values to zero with higher threshold
  const roundToThreshold = (value: number): number => {
    // For thrust, use a smaller threshold (percentage based)
    if (Math.abs(value) <= 100) { // It's likely a thrust value (0-100)
      return Math.abs(value) < 1.0 ? 0 : value;
    }
    // For other controls (roll, pitch, yaw), use a higher threshold
    return Math.abs(value) < CONTROL_THRESHOLD ? 0 : value;
  };

  // Send command using the same pattern as manual mode
  const sendControlCommand = useCallback((command: DroneCommand) => {
    // Force exact zeros when values are small
    const processedCommand = {
      thrust: Math.abs(command.thrust) < 1.0 ? 0 : command.thrust,
      roll: Math.abs(command.roll) < 5.0 ? 0 : command.roll,
      pitch: Math.abs(command.pitch) < 5.0 ? 0 : command.pitch,
      yaw: Math.abs(command.yaw) < 5.0 ? 0 : command.yaw
    };
    
    // Round very small values to 0 (additional safety)
    const roundedCommand = {
      thrust: roundToThreshold(processedCommand.thrust),
      roll: roundToThreshold(processedCommand.roll),
      pitch: roundToThreshold(processedCommand.pitch),
      yaw: roundToThreshold(processedCommand.yaw)
    };

    // Ensure thrust is within 0-100 range
    roundedCommand.thrust = Math.max(0, Math.min(100, roundedCommand.thrust));
    
    // Only send if values have changed
    if (roundedCommand.thrust !== lastSentValues.current.thrust ||
        roundedCommand.roll !== lastSentValues.current.roll ||
        roundedCommand.pitch !== lastSentValues.current.pitch ||
        roundedCommand.yaw !== lastSentValues.current.yaw) {
      
      // Update last sent values
      lastSentValues.current = { ...roundedCommand };
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket sending command:', roundedCommand);
        wsRef.current.send(JSON.stringify({
          type: 'command',
          command: roundedCommand
        }));
        return true;
      }
    }
    
    return false;
  }, []);

  // Run program with improved command handling
  const runProgram = async () => {
    if (isRunning || !connected) return;
    
    // Make sure we're connected before starting
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not open, can't run program");
      alert("Please connect to the drone first");
      return;
    }
    
    setIsRunning(true);
    console.log("Starting program execution");

    try {
      // First send a stop command to ensure we start from a clean state
      sendControlCommand({ thrust: 0, roll: 0, pitch: 0, yaw: 0 });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Run each step in sequence
      for (let i = 0; i < program.length; i++) {
        if (!connected) {
          console.error("Connection lost during program execution");
          break;
        }
        
        const step = program[i];
        setCurrentStepIndex(i);
        setRemainingTime(step.duration);
        console.log(`Executing step ${i+1}/${program.length}: ${step.name}`);
        
        if (step.name === 'Take Off') {
          // Takeoff - gradually increase thrust
          const startTime = Date.now();
          const duration = step.duration;
          const targetThrust = step.command.thrust;
          
          while (Date.now() - startTime < duration && connected) {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1.0, elapsed / duration);
            const currentThrust = targetThrust * progress;
            
            sendControlCommand({
              thrust: currentThrust,
              roll: 0,
              pitch: 0,
              yaw: 0
            });
            
            setRemainingTime(duration - elapsed);
            await new Promise(resolve => setTimeout(resolve, COMMAND_INTERVAL));
          }
          
          // Stabilize at target thrust
          sendControlCommand({
            thrust: targetThrust,
            roll: 0,
            pitch: 0,
            yaw: 0
          });
          
        } else if (step.name === 'Land') {
          // Landing - gradually decrease thrust
          const startTime = Date.now();
          const duration = step.duration;
          const startThrust = i > 0 ? lastSentValues.current.thrust : 60;
          
          while (Date.now() - startTime < duration && connected) {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1.0, elapsed / duration);
            const currentThrust = startThrust * (1 - progress);
            
            sendControlCommand({
              thrust: currentThrust,
              roll: 0,
              pitch: 0,
              yaw: 0
            });
            
            setRemainingTime(duration - elapsed);
            await new Promise(resolve => setTimeout(resolve, COMMAND_INTERVAL));
          }
          
          // Final stop command - send multiple times to ensure it's received
          sendControlCommand({ thrust: 0, roll: 0, pitch: 0, yaw: 0 });
          await new Promise(resolve => setTimeout(resolve, 50));
          sendControlCommand({ thrust: 0, roll: 0, pitch: 0, yaw: 0 });
          await new Promise(resolve => setTimeout(resolve, 50));
          sendControlCommand({ thrust: 0, roll: 0, pitch: 0, yaw: 0 });
          
        } else {
          // Movement commands
          // Send the command and maintain it for the duration
          sendControlCommand(step.command);
          
          const startTime = Date.now();
          while (Date.now() - startTime < step.duration && connected) {
            const remaining = step.duration - (Date.now() - startTime);
            setRemainingTime(remaining);
            
            // Send the same command periodically to ensure it's maintained
            if ((Date.now() - startTime) % 200 === 0) {
              sendControlCommand(step.command);
            }
            
            await new Promise(resolve => setTimeout(resolve, COMMAND_INTERVAL));
          }
          
          // Stop movement but maintain altitude
          sendControlCommand({ 
            thrust: step.command.thrust, 
            roll: 0, 
            pitch: 0, 
            yaw: 0 
          });
          
          // Small delay to stabilize
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Small pause between steps
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log("Program execution completed");
      
    } catch (error) {
      console.error('Error running program:', error);
    } finally {
      // Send multiple final stop commands for safety
      sendControlCommand({ thrust: 0, roll: 0, pitch: 0, yaw: 0 });
      await new Promise(resolve => setTimeout(resolve, 50));
      sendControlCommand({ thrust: 0, roll: 0, pitch: 0, yaw: 0 });
      await new Promise(resolve => setTimeout(resolve, 50));
      sendControlCommand({ thrust: 0, roll: 0, pitch: 0, yaw: 0 });
      
      setIsRunning(false);
      setCurrentStepIndex(null);
      setRemainingTime(null);
    }
  };

  const addCommand = (command: CommandConfig) => {
    setProgram(prev => {
      const newProgram = [...prev];
      // Insert before the Land command
      newProgram.splice(newProgram.length - 1, 0, { ...command });
      return newProgram;
    });
  };

  const removeCommand = (index: number) => {
    setProgram(prev => {
      // Don't remove Take Off or Land
      if (prev[index].isSpecial) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateCommand = (index: number, updates: Partial<CommandConfig>) => {
    setProgram(prev => {
      const newProgram = [...prev];
      newProgram[index] = { ...newProgram[index], ...updates };
      return newProgram;
    });
  };

  return (
    <div className="container mx-auto p-4">
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
        <h1 className="text-2xl font-bold text-white">Flight Planner</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Available Commands */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Available Commands</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={connectToDrone}
                disabled={connecting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                  connecting ? 'bg-yellow-600 cursor-wait' :
                  connected ? 'bg-green-600 hover:bg-green-700' :
                  'bg-blue-600 hover:bg-blue-700'
                } transition-colors`}
              >
                {connecting ? 'Connecting...' :
                 connected ? 'Disconnect' :
                 'Connect Drone'}
              </button>
              <button
                onClick={runProgram}
                disabled={isRunning || !connected}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                  isRunning || !connected
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                <Play size={20} />
                {isRunning ? 'Running...' : 'Run Program'}
              </button>
            </div>
          </div>

          {DEFAULT_COMMANDS.filter(cmd => !cmd.name.match(/Take Off|Land/)).map((command) => (
            <div
              key={command.name}
              className="bg-gray-800 p-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-white">
                  {CommandIcons[command.name]}
                  <span className="font-medium">{command.name}</span>
                </div>
                <button
                  onClick={() => addCommand(command)}
                  className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <Plus size={20} className="text-green-500" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Program Sequence */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Program Sequence</h2>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-gray-300 hover:text-white"
            >
              Advanced Settings
              {showAdvanced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>

          {program.map((step, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg ${
                step.isSpecial ? 'bg-blue-900 hover:bg-blue-800' : 'bg-gray-800 hover:bg-gray-700'
              } transition-colors ${
                currentStepIndex === index ? 'ring-2 ring-green-500' : ''
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 text-white">
                  {CommandIcons[step.name]}
                  <span className="font-medium">{step.name}</span>
                  {currentStepIndex === index && remainingTime !== null && (
                    <span className="text-sm text-green-400">
                      {Math.ceil(remainingTime / 100) / 10}s
                    </span>
                  )}
                </div>
                {!step.isSpecial && (
                  <button
                    onClick={() => removeCommand(index)}
                    className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                    disabled={isRunning}
                  >
                    <Trash size={20} className="text-red-500" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-sm text-gray-400">
                    Duration (ms)
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        value={step.duration}
                        onChange={(e) => updateCommand(index, { duration: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="w-16 text-right">{step.duration}</span>
                    </div>
                  </label>
                </div>

              {showAdvanced && step.advanced && (
                <div className="space-y-2 pt-2 border-t border-gray-700">
                  <label className="block text-sm text-gray-400">
                    Thrust (%)
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={step.advanced.thrust}
                        onChange={(e) => {
                          const thrust = Number(e.target.value);
                          updateCommand(index, {
                            advanced: { ...step.advanced, thrust },
                            command: { ...step.command, thrust }
                          });
                        }}
                        className="flex-1"
                      />
                      <span className="w-16 text-right">{step.advanced.thrust}</span>
                    </div>
                  </label>

                  {step.advanced.pitch !== undefined && (
                    <label className="block text-sm text-gray-400">
                      Pitch (degrees)
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="-45"
                          max="45"
                          value={step.advanced.pitch}
                          onChange={(e) => {
                            const pitch = Number(e.target.value);
                            updateCommand(index, {
                              advanced: { ...step.advanced, pitch },
                              command: { ...step.command, pitch }
                            });
                          }}
                          className="flex-1"
                        />
                        <span className="w-16 text-right">{step.advanced.pitch}</span>
                      </div>
                    </label>
                  )}

                  {step.advanced.yaw !== undefined && (
                    <label className="block text-sm text-gray-400">
                      Yaw (degrees)
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="-45"
                          max="45"
                          value={step.advanced.yaw}
                          onChange={(e) => {
                            const yaw = Number(e.target.value);
                            updateCommand(index, {
                              advanced: { ...step.advanced, yaw },
                              command: { ...step.command, yaw }
                            });
                          }}
                          className="flex-1"
                        />
                        <span className="w-16 text-right">{step.advanced.yaw}</span>
                      </div>
                    </label>
                  )}
                </div>
              )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Program;
