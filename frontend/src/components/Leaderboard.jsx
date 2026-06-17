import React, { useState, useEffect } from 'react';

export default function Leaderboard() {
  // 'official' or 'live' depending on which tab is clicked
  const [mode, setMode] = useState('live'); 
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      setLoading(true);
      try {
        // Enforce the explicit ?mode= query parameter matching the active tab
        const response = await fetch(`https://wc-2026-bracket-challenge.vercel.app/api/scores?mode=${mode}`);
        const data = await response.json();
        setScores(data);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchScores();
  }, [mode]); // Re-fetches automatically whenever the user clicks a tab!

  return (
    <div className="p-6">
      {/* Tab Switcher */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setMode('live')} 
          className={`px-4 py-2 rounded ${mode === 'live' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-200'}`}
        >
          Live Trend Leaderboard
        </button>
        <button 
          onClick={() => setMode('official')} 
          className={`px-4 py-2 rounded ${mode === 'official' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-200'}`}
        >
          Official Leaderboard
        </button>
      </div>

      {loading ? (
        <div>Loading scores...</div>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2">Rank</th>
              <th className="py-2">Name</th>
              <th className="py-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((user, index) => (
              <tr key={user.user_id} className="border-b">
                <td className="py-2">{index + 1}</td>
                <td className="py-2 font-medium">{user.user_name}</td>
                {/* Unified fallback so it reads whatever property name your UI keys off of */}
                <td className="py-2 font-bold text-green-600">
                  {user.total ?? user.score ?? 0} points
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}