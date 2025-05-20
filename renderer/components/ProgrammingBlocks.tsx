import React from 'react';
import { Trash2 } from 'lucide-react';

export interface Block {
  id: string;
  type: 'throttle' | 'pitch' | 'roll' | 'yaw' | 'wait' | 'composite';
  params: {
    throttle?: number;
    yaw?: number;
    pitch?: number;
    roll?: number;
    duration?: number;
  };
}

interface BlockProps {
  block: Block;
  onEdit: (id: string, params: Block['params']) => void;
  onDelete: (id: string) => void;
}

// Control constants matching DroneControl.tsx
const MAX_THRUST = 100; // Using percentage for better UX
const MAX_YAW = 180;
const MAX_PITCH = 30; // Using the DEFAULT_PITCH_RATE from DroneControl

export const ProgramBlock: React.FC<BlockProps> = ({ block, onEdit, onDelete }) => {
  const handleParamChange = (param: string, value: number | undefined) => {
    onEdit(block.id, { ...block.params, [param]: value });
  };

  const renderSlider = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void,
    unit: string,
    step: number = 1
  ) => (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-center">
        <span className="text-gray-300">{label}:</span>
        <span className="text-gray-300 w-16 text-right">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500 bg-gray-700 h-2 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );

  const renderDurationInput = () => (
    <div className="flex items-center gap-2 mt-4">
      <label className="text-gray-300">Duration (optional):</label>
      <input
        type="number"
        min="0"
        step="0.1"
        value={block.params.duration || ''}
        onChange={(e) => handleParamChange('duration', e.target.value ? Number(e.target.value) : undefined)}
        placeholder="∞"
        className="bg-gray-700 text-white px-2 py-1 rounded w-20"
      />
      <span className="text-gray-300">seconds</span>
    </div>
  );

  const renderParams = () => {
    switch (block.type) {
      case 'throttle':
        return (
          <div className="w-full">
            {renderSlider(
              'Throttle',
              block.params.throttle || 0,
              0,
              MAX_THRUST,
              (value) => handleParamChange('throttle', value),
              '%'
            )}
            {renderDurationInput()}
          </div>
        );
      case 'pitch':
        return (
          <div className="w-full">
            {renderSlider(
              'Forward/Backward',
              block.params.pitch || 0,
              -MAX_PITCH,
              MAX_PITCH,
              (value) => handleParamChange('pitch', value),
              '°'
            )}
            {renderDurationInput()}
          </div>
        );
      case 'roll':
        return (
          <div className="w-full">
            {renderSlider(
              'Left/Right',
              block.params.roll || 0,
              -MAX_PITCH,
              MAX_PITCH,
              (value) => handleParamChange('roll', value),
              '°'
            )}
            {renderDurationInput()}
          </div>
        );
      case 'yaw':
        return (
          <div className="w-full">
            {renderSlider(
              'Rotation',
              block.params.yaw || 0,
              -MAX_YAW,
              MAX_YAW,
              (value) => handleParamChange('yaw', value),
              '°'
            )}
            {renderDurationInput()}
          </div>
        );
      case 'wait':
        return (
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Wait:</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={block.params.duration || 0}
              onChange={(e) => handleParamChange('duration', Number(e.target.value))}
              className="bg-gray-700 text-white px-2 py-1 rounded w-20"
              required
            />
            <span className="text-gray-300">seconds</span>
          </div>
        );
      case 'composite':
        return (
          <div className="space-y-4 w-full">
            {renderSlider(
              'Throttle',
              block.params.throttle || 0,
              0,
              MAX_THRUST,
              (value) => handleParamChange('throttle', value),
              '%'
            )}
            {renderSlider(
              'Forward/Backward',
              block.params.pitch || 0,
              -MAX_PITCH,
              MAX_PITCH,
              (value) => handleParamChange('pitch', value),
              '°'
            )}
            {renderSlider(
              'Left/Right',
              block.params.roll || 0,
              -MAX_PITCH,
              MAX_PITCH,
              (value) => handleParamChange('roll', value),
              '°'
            )}
            {renderSlider(
              'Rotation',
              block.params.yaw || 0,
              -MAX_YAW,
              MAX_YAW,
              (value) => handleParamChange('yaw', value),
              '°'
            )}
            {renderDurationInput()}
          </div>
        );
    }
  };

  const getBlockColor = () => {
    switch (block.type) {
      case 'throttle': return 'bg-blue-900';
      case 'pitch': return 'bg-green-900';
      case 'roll': return 'bg-purple-900';
      case 'yaw': return 'bg-pink-900';
      case 'wait': return 'bg-gray-800';
      case 'composite': return 'bg-indigo-900';
      default: return 'bg-gray-800';
    }
  };

  return (
    <div className={`p-4 rounded-lg ${getBlockColor()} relative group`}>
      <button
        onClick={() => onDelete(block.id)}
        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors"
      >
        <Trash2 className="w-5 h-5" />
      </button>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white capitalize mb-4">
          {block.type} Block
        </h3>
        {renderParams()}
      </div>
    </div>
  );
};
