import React from 'react';
import packageJson from '../../package.json';

interface BuildInfoProps {
  className?: string;
}

const BuildInfo: React.FC<BuildInfoProps> = ({ className = '' }) => {
  // Get version from package.json
  const version = packageJson.version || '0.1.1';
  
  // Extract build number from version (assuming 0.1.x format where x is build number)
  const buildNumber = version.split('.')[2] || '1';

  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      <span>v{version.split('.').slice(0, 2).join('.')}</span>
      <span className="mx-1">•</span>
      <span>build {buildNumber}</span>
    </div>
  );
};

export default BuildInfo;