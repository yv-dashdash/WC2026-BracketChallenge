import React, { useState, useEffect } from 'react';

export default function Leaderboard() {
  const [mode, setMode] = useState('live'); // 'live' or 'official'
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      setLoading(true);
      try {
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
  }, [mode]);

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#111827]/50 backdrop-blur-md rounded-2xl border border-gray-800 p-6 shadow-xl">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white tracking-wide">Tournament Standings</h2>
        
        <div className="flex bg-gray-900/80 p-1 rounded-xl border border-gray-800">
          <button
            onClick={() => setMode('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              mode === 'live'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ⚡ Live Trend
          </button>
          <button
            onClick={() => setMode('official')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              mode === 'official'
                ? 'bg-amber-500 text-black font-bold shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🏆 Official
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 animate-pulse">Loading standings...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800/60">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-gray-800">
                <th className="py-3 px-4 w-16">#</th>
                <th className="py-3 px-4">Participant</th>
                <th className="py-3 px-4 text-right w-24">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40 text-gray-300">
              {scores.map((user, index) => (
                <tr key={user.user_id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-500">{index + 1}</td>
                  <td className="py-3 px-4 font-medium text-white border-b border-transparent">{user.user_name}</td>
                  <td className={`py-3 px-4 text-right font-bold text-base ${
                    mode === 'live' ? 'text-blue-400' : 'text-amber-400'
                  }`}>
                    {user.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}