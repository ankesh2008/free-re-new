/**
 * Standard ELO rating algorithm for 1v1 competitive coding matches.
 * K-factor = 32 by default.
 */
export function calculateEloChange(
  p1Elo: number,
  p2Elo: number,
  outcome: 'p1_win' | 'p2_win' | 'draw',
  kFactor: number = 32
): { p1NewElo: number; p2NewElo: number; p1Delta: number; p2Delta: number } {
  const expectedP1 = 1 / (1 + Math.pow(10, (p2Elo - p1Elo) / 400));
  const expectedP2 = 1 / (1 + Math.pow(10, (p1Elo - p2Elo) / 400));

  let actualP1 = 0.5;
  let actualP2 = 0.5;

  if (outcome === 'p1_win') {
    actualP1 = 1;
    actualP2 = 0;
  } else if (outcome === 'p2_win') {
    actualP1 = 0;
    actualP2 = 1;
  }

  const p1Delta = Math.round(kFactor * (actualP1 - expectedP1));
  const p2Delta = Math.round(kFactor * (actualP2 - expectedP2));

  return {
    p1NewElo: Math.max(100, p1Elo + p1Delta),
    p2NewElo: Math.max(100, p2Elo + p2Delta),
    p1Delta,
    p2Delta,
  };
}
