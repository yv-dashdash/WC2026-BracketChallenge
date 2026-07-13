import React, { useEffect, useState } from 'react';

export default function OddsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = 'https://wc-2026-bracket-challenge.vercel.app';

  useEffect(() => {
    fetch(`${API_URL}/api/odds`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load odds simulation data.');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', border: '4px solid #ffcc00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: '#8b949e', fontSize: '14px' }}>Running bracket outcome calculations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '440px', margin: '3rem auto', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '1rem', borderRadius: '12px', textAlign: 'center', fontSize: '14px' }}>
        ⚠️ Error: {error}
      </div>
    );
  }

  const oddsList = data?.odds || [];
  const totalOutcomes = data?.outcomes_calculated || 8;

  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* ── Title & Intro Header ── */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: '900', color: '#fff', trackingTight: '-0.025em' }}>
          Winning <span style={{ color: '#ffcc00' }}>Odds</span>
        </h2>
        <p style={{ color: '#8b949e', marginTop: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
          Probability of winning the pool — simulated from the current bracket
        </p>
      </div>

      {/* ── Payout Pool Dashboard Widget ── */}
      <div style={{ display: 'flex', justifyContent: 'space-around', background: '#161b22', border: '1px solid #21262d', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '600px', marginBottom: '2rem', alignItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🥇</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8b949e', textTransform: 'uppercase' }}>1st Place</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff', marginTop: '0.25rem' }}>30 CHF</div>
          <div style={{ fontSize: '11px', color: '#ffcc00', fontWeight: '600' }}>50%</div>
        </div>
        <div style={{ height: '40px', width: '1px', background: '#21262d' }}></div>
        <div>
          <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🥈</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8b949e', textTransform: 'uppercase' }}>2nd Place</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff', marginTop: '0.25rem' }}>18 CHF</div>
          <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: '600' }}>30%</div>
        </div>
        <div style={{ height: '40px', width: '1px', background: '#21262d' }}></div>
        <div>
          <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🥉</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8b949e', textTransform: 'uppercase' }}>3rd Place</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff', marginTop: '0.25rem' }}>12 CHF</div>
          <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: '600' }}>20%</div>
        </div>
      </div>

      {/* ── Dynamic Bar Chart Wrapper ── */}
      <div style={{ background: '#161b22', border: '1px solid #21262d', padding: '2rem', borderRadius: '12px', width: '100%', boxHighlight: '0 10px 25px -5px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>Winning Odds</h3>
          <span style={{ color: '#8c9eff', fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '12px', border: '1px solid #2d3554', background: '#1f2438' }}>
            {totalOutcomes} outcomes
          </span>
        </div>

        <p style={{ fontSize: '12px', color: '#8b949e', lineHeight: '1.6', marginBottom: '2rem' }}>
          Every remaining match is treated as a 50/50 coin flip, and{' '}
          <span style={{ color: '#fff', fontWeight: 'bold' }}>all 8 possible ways the tournament can still play out</span> are
          enumerated exactly. For each outcome we score every bracket and see who finishes on top — the bar shows the
          share of futures in which each player wins the pool (ties for 1st all count as a win).
        </p>

        {/* ── Rows ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {oddsList.map((player, idx) => {
            const pct = player.winning_probability || 0;

            return (
              <div key={player.user_id || idx} style={{ display: 'flex', alignItems: 'center', height: '28px' }}>
                <div style={{ width: '30px', textAlign: 'right', paddingRight: '12px', fontWeight: '600', color: '#57606a', fontSize: '13px' }}>
                  {idx + 1}
                </div>

                <div style={{ width: '160px', textAlign: 'left', fontWeight: 'bold', color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                  {player.user_name}
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: '100%', gap: '12px' }}>
                  <div style={{ flex: 1, background: 'transparent', height: '100%', position: 'relative', borderRadius: '4px', overflow: 'hidden' }}>
                    {pct > 0 && (
                      <div
                        style={{ 
                          width: `${pct}%`,
                          background: '#ffcc00',
                          height: '100%',
                          borderRadius: '4px',
                          boxShadow: '0 0 8px rgba(255,204,0,0.2)',
                          transition: 'width 1s ease-out'
                        }}
                      />
                    )}
                  </div>
                  <div style={{ width: '40px', textAlign: 'right', fontWeight: '900', color: '#c9d1d9', fontSize: '13px' }}>
                    {pct}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ width: '100%', textAlign: 'left', fontSize: '11px', color: '#57606a', marginTop: '1rem', lineHeight: '1.5' }}>
        Odds reflect points still up for grabs in the knockout rounds plus everything already locked in. As results are
        recorded they collapse toward the eventual winner.
      </p>
    </div>
  );
}