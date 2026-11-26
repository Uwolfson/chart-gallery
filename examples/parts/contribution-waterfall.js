/* Synthetic demo for ChartKit.contributionWaterfall — why hotel D is recommended more often than the average hotel (invented values). */
(function (global) {
  'use strict';
  global.DEMO = global.DEMO || {};
  global.DEMO.contributionWaterfall = function () {
    const steps = [
      { name: 'Location', value: 3.8, ci: 1.0 }, { name: 'Staff friendliness', value: 2.6, ci: 0.8 }, { name: 'Noise insulation', value: -2.2, ci: 0.9 },
      { name: 'Breakfast quality', value: 1.9, ci: 0.7 }, { name: 'Parking', value: -1.4, ci: 0.6 }, { name: 'Bed comfort', value: 1.2, ci: 0.6 },
      { name: 'Wi-Fi', value: -0.9, ci: 0.5 }, { name: 'Room cleanliness', value: 0.8, ci: 0.5 }, { name: 'Check-in speed', value: 0.5, ci: 0.4 },
      { name: 'Pool or gym', value: 0.4, ci: 0.4 }, { name: 'Air conditioning', value: -0.3, ci: 0.3 }, { name: 'Late checkout', value: 0.2, ci: 0.3 } ];
    return { start: { label: 'Average hotel', value: 54.0 }, end: { label: 'Hotel D, actual', value: 62.1 }, steps,
      unit: '%', stepUnit: 'pp', summaryLabel: 'All attributes together', residualLabel: 'Not explained by attributes' };
  };
})(window);
