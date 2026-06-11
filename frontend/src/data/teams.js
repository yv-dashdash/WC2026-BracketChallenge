// 2026 World Cup — 48 teams in 12 groups of 4
// Official groups from the FIFA World Cup 2026 wall chart.

export const GROUPS = {
  A: {
    teams: [
      { name: 'Mexico', flag: '🇲🇽', confederation: 'CONCACAF' },
      { name: 'South Korea', flag: '🇰🇷', confederation: 'AFC' },
      { name: 'Czech Republic', flag: '🇨🇿', confederation: 'UEFA' },
      { name: 'South Africa', flag: '🇿🇦', confederation: 'CAF' },
    ],
  },
  B: {
    teams: [
      { name: 'Canada', flag: '🇨🇦', confederation: 'CONCACAF' },
      { name: 'Qatar', flag: '🇶🇦', confederation: 'AFC' },
      { name: 'Switzerland', flag: '🇨🇭', confederation: 'UEFA' },
      { name: 'Bosnia and Herzegovina', flag: '🇧🇦', confederation: 'UEFA' },
    ],
  },
  C: {
    teams: [
      { name: 'Brazil', flag: '🇧🇷', confederation: 'CONMEBOL' },
      { name: 'Haiti', flag: '🇭🇹', confederation: 'CONCACAF' },
      { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA' },
      { name: 'Morocco', flag: '🇲🇦', confederation: 'CAF' },
    ],
  },
  D: {
    teams: [
      { name: 'United States', flag: '🇺🇸', confederation: 'CONCACAF' },
      { name: 'Australia', flag: '🇦🇺', confederation: 'AFC' },
      { name: 'Turkey', flag: '🇹🇷', confederation: 'UEFA' },
      { name: 'Paraguay', flag: '🇵🇾', confederation: 'CONMEBOL' },
    ],
  },
  E: {
    teams: [
      { name: 'Germany', flag: '🇩🇪', confederation: 'UEFA' },
      { name: "Côte d'Ivoire", flag: '🇨🇮', confederation: 'CAF' },
      { name: 'Ecuador', flag: '🇪🇨', confederation: 'CONMEBOL' },
      { name: 'Curaçao', flag: '🇨🇼', confederation: 'CONCACAF' },
    ],
  },
  F: {
    teams: [
      { name: 'Netherlands', flag: '🇳🇱', confederation: 'UEFA' },
      { name: 'Sweden', flag: '🇸🇪', confederation: 'UEFA' },
      { name: 'Tunisia', flag: '🇹🇳', confederation: 'CAF' },
      { name: 'Japan', flag: '🇯🇵', confederation: 'AFC' },
    ],
  },
  G: {
    teams: [
      { name: 'Belgium', flag: '🇧🇪', confederation: 'UEFA' },
      { name: 'Iran', flag: '🇮🇷', confederation: 'AFC' },
      { name: 'New Zealand', flag: '🇳🇿', confederation: 'OFC' },
      { name: 'Egypt', flag: '🇪🇬', confederation: 'CAF' },
    ],
  },
  H: {
    teams: [
      { name: 'Spain', flag: '🇪🇸', confederation: 'UEFA' },
      { name: 'Saudi Arabia', flag: '🇸🇦', confederation: 'AFC' },
      { name: 'Uruguay', flag: '🇺🇾', confederation: 'CONMEBOL' },
      { name: 'Cape Verde', flag: '🇨🇻', confederation: 'CAF' },
    ],
  },
  I: {
    teams: [
      { name: 'France', flag: '🇫🇷', confederation: 'UEFA' },
      { name: 'Iraq', flag: '🇮🇶', confederation: 'AFC' },
      { name: 'Norway', flag: '🇳🇴', confederation: 'UEFA' },
      { name: 'Senegal', flag: '🇸🇳', confederation: 'CAF' },
    ],
  },
  J: {
    teams: [
      { name: 'Argentina', flag: '🇦🇷', confederation: 'CONMEBOL' },
      { name: 'Austria', flag: '🇦🇹', confederation: 'UEFA' },
      { name: 'Algeria', flag: '🇩🇿', confederation: 'CAF' },
      { name: 'Jordan', flag: '🇯🇴', confederation: 'AFC' },
    ],
  },
  K: {
    teams: [
      { name: 'Portugal', flag: '🇵🇹', confederation: 'UEFA' },
      { name: 'Uzbekistan', flag: '🇺🇿', confederation: 'AFC' },
      { name: 'Colombia', flag: '🇨🇴', confederation: 'CONMEBOL' },
      { name: 'DR Congo', flag: '🇨🇩', confederation: 'CAF' },
    ],
  },
  L: {
    teams: [
      { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA' },
      { name: 'Ghana', flag: '🇬🇭', confederation: 'CAF' },
      { name: 'Panama', flag: '🇵🇦', confederation: 'CONCACAF' },
      { name: 'Croatia', flag: '🇭🇷', confederation: 'UEFA' },
    ],
  },
};

export const GROUP_NAMES = Object.keys(GROUPS);

export const ALL_TEAMS = GROUP_NAMES.flatMap(g => GROUPS[g].teams.map(t => ({ ...t, group: g })));

export const getTeam = (name) => ALL_TEAMS.find(t => t.name === name);

export const getGroupTeams = (group) => GROUPS[group]?.teams ?? [];

// Round of 32 bracket structure — official 2026 WC wall chart match IDs and seedings.
// Slots marked '3rd_N' are filled by the 8 best third-place teams the user selects.

// LEFT SIDE (feeds into Semifinal 1)
// Top quarter → R16-m89 → QF1
// Middle → R16-m90 → QF1
// Bottom (inner) → R16-m93 → QF2
// Bottom (outer) → R16-m94 → QF2
// RIGHT SIDE (feeds into Semifinal 2)
// Top → R16-m91 → QF3
// Middle → R16-m92 → QF3
// Bottom (inner) → R16-m95 → QF4
// Bottom (outer) → R16-m96 → QF4
export const R32_MATCHES = [
  // Left side — top quarter → R16-m89
  { id: 'r32_m74', team1Seed: '1E', team2Seed: '3rd_1' },
  { id: 'r32_m77', team1Seed: '1I', team2Seed: '3rd_2' },
  // Left side — middle → R16-m90
  { id: 'r32_m73', team1Seed: '2A', team2Seed: '2B' },
  { id: 'r32_m75', team1Seed: '1F', team2Seed: '2C' },
  // Left side — bottom inner → R16-m93
  { id: 'r32_m83', team1Seed: '2K', team2Seed: '2L' },
  { id: 'r32_m84', team1Seed: '1H', team2Seed: '2J' },
  // Left side — bottom outer → R16-m94
  { id: 'r32_m81', team1Seed: '1D', team2Seed: '3rd_3' },
  { id: 'r32_m82', team1Seed: '1G', team2Seed: '3rd_4' },
  // Right side — top → R16-m91
  { id: 'r32_m76', team1Seed: '1C', team2Seed: '2F' },
  { id: 'r32_m78', team1Seed: '2E', team2Seed: '2I' },
  // Right side — middle → R16-m92
  { id: 'r32_m79', team1Seed: '1A', team2Seed: '3rd_5' },
  { id: 'r32_m80', team1Seed: '1L', team2Seed: '3rd_6' },
  // Right side — bottom inner → R16-m95
  { id: 'r32_m86', team1Seed: '1J', team2Seed: '2H' },
  { id: 'r32_m88', team1Seed: '2D', team2Seed: '2G' },
  // Right side — bottom outer → R16-m96
  { id: 'r32_m85', team1Seed: '1B', team2Seed: '3rd_7' },
  { id: 'r32_m87', team1Seed: '1K', team2Seed: '3rd_8' },
];

// R16 bracket — winners of R32 pairs
export const R16_MATCHES = [
  { id: 'r16_m89', prevMatch1: 'r32_m74', prevMatch2: 'r32_m77' },
  { id: 'r16_m90', prevMatch1: 'r32_m73', prevMatch2: 'r32_m75' },
  { id: 'r16_m93', prevMatch1: 'r32_m83', prevMatch2: 'r32_m84' },
  { id: 'r16_m94', prevMatch1: 'r32_m81', prevMatch2: 'r32_m82' },
  { id: 'r16_m91', prevMatch1: 'r32_m76', prevMatch2: 'r32_m78' },
  { id: 'r16_m92', prevMatch1: 'r32_m79', prevMatch2: 'r32_m80' },
  { id: 'r16_m95', prevMatch1: 'r32_m86', prevMatch2: 'r32_m88' },
  { id: 'r16_m96', prevMatch1: 'r32_m85', prevMatch2: 'r32_m87' },
];

export const QF_MATCHES = [
  { id: 'qf_01', prevMatch1: 'r16_m89', prevMatch2: 'r16_m90' },
  { id: 'qf_02', prevMatch1: 'r16_m93', prevMatch2: 'r16_m94' },
  { id: 'qf_03', prevMatch1: 'r16_m91', prevMatch2: 'r16_m92' },
  { id: 'qf_04', prevMatch1: 'r16_m95', prevMatch2: 'r16_m96' },
];

export const SF_MATCHES = [
  { id: 'sf_01', prevMatch1: 'qf_01', prevMatch2: 'qf_02' },
  { id: 'sf_02', prevMatch1: 'qf_03', prevMatch2: 'qf_04' },
];

export const FINAL_MATCH = { id: 'final', prevMatch1: 'sf_01', prevMatch2: 'sf_02' };
export const THIRD_MATCH = { id: 'third', prevMatch1: 'sf_01_loser', prevMatch2: 'sf_02_loser' };
