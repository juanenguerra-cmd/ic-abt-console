import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';

interface LockScreenProps {
  onUnlock: () => void;
  onAdminLogin: (password: string) => boolean;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, onAdminLogin }) => {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onAdminLogin(password);
    if (!success) {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900 flex flex-col items-center justify-center text-white z-50">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-emerald-500">Infection Control & Antibiotic Stewardship Console</h1>
        <p className="text-xl text-neutral-300">Juan Enguerra RN</p>
      </div>

      <div className="absolute bottom-10 flex flex-col items-center gap-6">
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

        {!showAdminForm ? (
          <button
            onClick={() => setShowAdminForm(true)}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-emerald-400 transition-colors"
            data-testid="admin-login-toggle"
          >
            <ShieldCheck className="w-4 h-4" />
            Login as Admin
          </button>
        ) : (
          <form onSubmit={handleAdminSubmit} className="flex flex-col items-center gap-3 w-64" data-testid="admin-login-form">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <ShieldCheck className="w-4 h-4" />
              Admin Login
            </div>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter admin password"
              autoFocus
              className="w-full px-4 py-2 rounded-md bg-white/10 border border-white/20 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-emerald-500"
              data-testid="admin-password-input"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => { setShowAdminForm(false); setPassword(''); setError(''); }}
                className="flex-1 py-2 rounded-md border border-white/20 text-neutral-400 text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                data-testid="admin-login-submit"
              >
                Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

