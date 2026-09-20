/* Chart.js initialisation. Data is passed from EJS via data-* attributes so no
   inline script or API call is needed. */
document.addEventListener('DOMContentLoaded', function () {
  var read = function (el, key) { try { return JSON.parse(el.dataset[key] || '[]'); } catch (e) { return []; } };

  var c = document.getElementById('consumptionChart');
  if (c && window.Chart) {
    new Chart(c, {
      type: 'line',
      data: {
        labels: read(c, 'labels'),
        datasets: [{
          label: 'Units consumed (kWh)',
          data: read(c, 'units'),
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13,110,253,.12)',
          fill: true, tension: .3, pointRadius: 4
        }]
      },
      options: { responsive: true, plugins: { legend: { display: true } },
                 scales: { y: { beginAtZero: true, title: { display: true, text: 'kWh' } } } }
    });
  }

  var a = document.getElementById('adminMonthlyChart');
  if (a && window.Chart) {
    new Chart(a, {
      type: 'bar',
      data: {
        labels: read(a, 'labels'),
        datasets: [
          { label: 'Units billed (kWh)', data: read(a, 'units'), backgroundColor: 'rgba(13,110,253,.7)', yAxisID: 'y' },
          { label: 'Revenue collected', data: read(a, 'revenue'), type: 'line', borderColor: '#198754', tension: .3, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y:  { beginAtZero: true, position: 'left',  title: { display: true, text: 'kWh' } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Rupees' } }
        }
      }
    });
  }
});
