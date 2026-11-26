/* Synthetic demo for ChartKit.semanticMap: ~540 points in 8 groups with 2–3 subgroups each, as if from a 2-D embedding of
   open-ended survey answers about a trip booked on a travel site. Coordinates are seeded gaussian blobs; words come from a neutral vocabulary. */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // group -> subgroups -> top words of the subgroup (the group's words are the first words of its subgroups)
  const TOPICS = {
    'price': { 'too expensive': ['expensive', 'price', 'overpriced'], 'hidden fees': ['fee', 'tax', 'extra charge'], 'good deal': ['deal', 'discount', 'bargain'] },
    'location': { 'close to the centre': ['centre', 'walk', 'close'], 'far from everything': ['far', 'taxi', 'remote'], 'public transport': ['metro', 'bus', 'station'] },
    'cleanliness': { 'dirty room': ['dirty', 'dust', 'stains'], 'spotless': ['clean', 'spotless', 'fresh'] },
    'booking process': { 'easy to book': ['easy', 'quick', 'simple'], 'confusing steps': ['confusing', 'steps', 'form'], 'payment failed': ['card', 'declined', 'payment'] },
    'photos accuracy': { 'looked better in photos': ['photos', 'smaller', 'older'], 'as described': ['exactly', 'described', 'matched'] },
    'cancellation policy': { 'refund': ['refund', 'money back', 'returned'], 'no free cancellation': ['non-refundable', 'penalty', 'cancel'] },
    'check-in': { 'long wait at the desk': ['queue', 'waiting', 'desk'], 'late arrival': ['late', 'night', 'key'] },
    'noise': { 'street noise': ['street', 'traffic', 'windows'], 'thin walls': ['walls', 'neighbours', 'loud'] },
  };
  const SENTENCES = ['All went well, nothing to add.', 'The stay was pleasant, I liked it.', 'Hard to say, it depends on the season.', 'Some things were good, some were not.', 'I would like more choice here.',
    'It was fine for the money.', 'The staff were polite.', 'Nothing special to mention.'];
  let CACHE = null;
  global.DEMO.semanticMap = function () {
    if (CACHE) return CACHE;
    const rand = rng(314), gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    const groups = Object.keys(TOPICS), points = [], words = { group: {}, sub: {}, cluster: {} };
    const SIZE = [102, 88, 76, 72, 60, 54, 48, 40];                                           // points per group, largest first
    groups.forEach((g, gi) => {
      const subs = Object.keys(TOPICS[g]), ang = 0.4 + (gi / groups.length) * 2 * Math.PI, gx = 10 * Math.cos(ang) + 2 * gauss(), gy = 10 * Math.sin(ang) + 2 * gauss();
      words.group[g] = subs.map(s => TOPICS[g][s][0]);
      subs.forEach((s, si) => {
        const sx = gx + 2.6 * Math.cos(ang + 2 + si * 2.1), sy = gy + 2.6 * Math.sin(ang + 2 + si * 2.1), per = Math.round(SIZE[gi] / subs.length), nCl = 2 + (si % 2);
        words.sub[s] = TOPICS[g][s];
        for (let ci = 0; ci < nCl; ci++) {
          const cname = s + ' / ' + (ci + 1), cx = sx + 1.1 * gauss(), cy = sy + 1.1 * gauss(), cw = TOPICS[g][s];
          words.cluster[cname] = [cw[ci % cw.length], cw[(ci + 1) % cw.length]];
          for (let k = 0; k < per / nCl; k++) {
            const r = rand(), group = r < 0.76 ? g : r < 0.89 ? groups[(gi + 1 + Math.floor(rand() * 7)) % groups.length] : null;   // 76% own group, 13% another group, 11% unlabelled
            points.push({ x: cx + 0.7 * gauss(), y: cy + 0.7 * gauss(), group, sub: s, cluster: cname,
              text: group ? 'About ' + s + ': ' + cw[Math.floor(rand() * cw.length)] + ' — ' + SENTENCES[Math.floor(rand() * SENTENCES.length)].toLowerCase() : SENTENCES[Math.floor(rand() * SENTENCES.length)] });
          }
        }
      });
    });
    CACHE = { points, groups, words, levels: [{ zoom: 1, field: 'group' }, { zoom: 2.2, field: 'sub' }, { zoom: 5, field: 'cluster' }], levelNames: ['level: groups', 'level: subgroups', 'level: small clusters'] };
    return CACHE;
  };
})(window);
