import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ensureDefaultFacility } from '../storage/repository';
import Login from '../components/Login';
import Dashboard from '../pages/Dashboard';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const fid = await ensureDefaultFacility(firebaseUser.uid);
          setFacilityId(fid);
        } catch {
          // If Firestore is unavailable, fall through without a facilityId
          setFacilityId(null);
        }
      } else {
        setFacilityId(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-100">
        <div className="text-neutral-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!facilityId) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-100">
        <div className="text-neutral-500">Setting up your facility…</div>
      </div>
    );
  }

  return (
    <>
      <Dashboard
        user={user}
        facilityId={facilityId}
        onSignOut={() => signOut(auth)}
      />
    </>
  );
};

export default App;
