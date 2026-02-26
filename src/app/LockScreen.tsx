import React from 'react';
import { Lock } from 'lucide-react';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  return (
    <div className="fixed inset-0 bg-neutral-900 flex flex-col items-center justify-center text-white z-50">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Infection Control & Antibiotic Stewardship Console</h1>
        <p className="text-xl text-neutral-300">Juan Enguerra RN</p>
      </div>
      <div className="absolute bottom-10">
        <button 
          onClick={onUnlock}
          className="flex flex-col items-center text-neutral-400 hover:text-white transition-colors group"
          data-testid="unlock-button"
        >
          <div className="p-4 bg-white/5 rounded-full group-hover:bg-white/10">
            <Lock className="w-8 h-8" />
          </div>
          <span className="mt-2 text-sm">Click to Unlock</span>
        </button>
      </div>
    </div>
  );
};
