document.addEventListener('DOMContentLoaded', () => {
    // Check for dependencies from script.js
    if (typeof getThemeColors !== 'function' || typeof showNotification !== 'function') {
        console.error("Incremental Reach app requires dependencies from script.js");
        return;
    }

    let reachChart = null;

    // --- DOM Elements ---
    const DOM_REACH = {
        view: document.getElementById('incremental-reach-view'),
        addBtn: document.getElementById('add-reach-row-btn'),
        inputBody: document.getElementById('incremental-reach-input-body'),
        chartContainer: document.getElementById('incremental-reach-chart-container'),
        chartCanvas: document.getElementById('incremental-reach-chart'),
        chartPlaceholder: document.getElementById('incremental-reach-placeholder'),
        darkModeCheckbox: document.getElementById('dark-mode-checkbox'),
    };

    // Exit if the view isn't present in the DOM
    if (!DOM_REACH.view) return;

    // --- Core Functions ---

    /**
     * Creates and appends a new row to the input table.
     */
    function addRow() {
        const row = document.createElement('tr');
        row.className = 'reach-data-row';
        row.innerHTML = `
            <td class="p-1"><input type="text" class="styled-input w-full p-2 rounded-lg" placeholder="e.g., Jan 2024"></td>
            <td class="p-1"><input type="number" data-type="reach" class="styled-input w-full p-2 rounded-lg" placeholder="0"></td>
            <td class="p-1"><input type="number" data-type="accumulated" class="styled-input w-full p-2 rounded-lg" placeholder="0"></td>
            <td class="p-1"><input type="text" class="styled-input w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700" readonly></td>
            <td class="p-1"><input type="text" class="styled-input w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700" readonly></td>
            <td class="p-1 text-center">
                <button class="delete-row-btn text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </td>
        `;
        DOM_REACH.inputBody.appendChild(row);
    }

    /**
     * Reads all data from the table, performs calculations, and updates the view.
     */
    function updateCalculationsAndRender() {
        const rows = DOM_REACH.inputBody.querySelectorAll('tr.reach-data-row');
        let previousAccumulated = 0;
        const dataForChart = [];

        rows.forEach((row, index) => {
            const inputs = row.querySelectorAll('input');
            const month = inputs[0].value || `Period ${index + 1}`;
            const reach = parseFloat(inputs[1].value) || 0;
            const accumulated = parseFloat(inputs[2].value) || 0;

            const incremental = Math.max(0, accumulated - previousAccumulated);
            const normalReach = Math.max(0, reach - incremental);
            const percentageNew = (reach > 0 && incremental > 0) ? (incremental / reach) * 100 : 0;

            // Update the readonly fields
            inputs[3].value = incremental.toLocaleString('de-DE');
            inputs[4].value = normalReach.toLocaleString('de-DE');
            
            dataForChart.push({
                month,
                reach,
                accumulated,
                incremental,
                normalReach,
                percentageNew
            });
            
            previousAccumulated = accumulated;
        });
        
        renderChart(dataForChart);
    }

    /**
     * Renders the chart based on the provided data.
     * @param {Array} data - The calculated data from the table.
     */
    function renderChart(data) {
        const hasData = data.some(d => d.reach > 0 || d.accumulated > 0);

        if (!hasData) {
            DOM_REACH.chartContainer.classList.add('hidden');
            DOM_REACH.chartPlaceholder.classList.remove('hidden');
            if (reachChart) {
                reachChart.destroy();
                reachChart = null;
            }
            return;
        }
        
        DOM_REACH.chartContainer.classList.remove('hidden');
        DOM_REACH.chartPlaceholder.classList.add('hidden');

        if (reachChart) reachChart.destroy();
        
        const themeColors = getThemeColors();
        const labels = data.map(d => d.month);

        const datalabelsPlugin = {
          id: 'customDatalabels',
          afterDatasetsDraw(chart, args, pluginOptions) {
            const { ctx } = chart;
            ctx.save();
            const labelFontColor = themeColors.title;

            chart.data.datasets.forEach((dataset, i) => {
              const meta = chart.getDatasetMeta(i);
              if (!meta.hidden) {
                meta.data.forEach((element, index) => {
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle'; // Center vertically

                    if (dataset.type === 'line') {
                        ctx.fillStyle = labelFontColor;
                        const value = dataset.data[index];
                        if (value !== null && value !== undefined) {
                            const label = `${value.toFixed(2)}%`;
                            ctx.fillText(label, element.x, element.y - 10); // Position above the point
                        }
                    } else if (dataset.stack) {
                        const value = dataset.data[index];
                        const segmentHeight = element.height;
                        
                        // Only show label if the bar segment is tall enough
                        if (value > 0 && segmentHeight > 15) {
                            const yPos = element.y + segmentHeight / 2;

                            // Use white text for the primary (darker) color if segment is tall enough
                            if (dataset.label === 'Incremental reach' && segmentHeight > 18) {
                                ctx.fillStyle = '#fff';
                            } else {
                                ctx.fillStyle = labelFontColor;
                            }
                            
                            ctx.fillText(value.toLocaleString('de-DE'), element.x, yPos);
                        }
                    }
                });
              }
            });
            ctx.restore();
          }
        };

        reachChart = new Chart(DOM_REACH.chartCanvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Incremental reach',
                        data: data.map(d => d.incremental),
                        backgroundColor: themeColors.primary,
                        stack: 'reachStack',
                        order: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'Normal reach',
                        data: data.map(d => d.normalReach),
                        backgroundColor: themeColors.secondary,
                        stack: 'reachStack',
                        order: 3,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: '%',
                        data: data.map(d => d.percentageNew),
                        borderColor: themeColors.danger,
                        backgroundColor: themeColors.dangerRgba,
                        type: 'line',
                        order: 1,
                        yAxisID: 'y1',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { 
                        stacked: true,
                        ticks: { color: themeColors.ticks }, 
                        grid: { display: false } 
                    },
                    y: { // Left axis for Reach
                        stacked: true,
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: false },
                        ticks: { 
                            color: themeColors.ticks,
                            callback: value => new Intl.NumberFormat('de-DE').format(value)
                        }, 
                        grid: { color: themeColors.grid },
                        beginAtZero: true
                    },
                    y1: { // Right axis for Percentage
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        max: 100,
                        title: { display: false },
                        ticks: {
                            color: themeColors.ticks,
                            callback: value => `${value.toFixed(0)}%`
                        },
                        grid: { drawOnChartArea: false } 
                    }
                },
                plugins: {
                    legend: { position: 'top', labels: { color: themeColors.legend } },
                    title: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                }
            },
            plugins: [datalabelsPlugin]
        });
    }

    // --- Event Handlers ---

    function handleTableEvents(event) {
        const target = event.target;
        // Handle input changes
        if (target.tagName === 'INPUT' && (target.type === 'number' || target.type === 'text')) {
            updateCalculationsAndRender();
        }
        // Handle row deletion
        const deleteBtn = target.closest('.delete-row-btn');
        if (deleteBtn) {
            deleteBtn.closest('tr').remove();
            updateCalculationsAndRender();
        }
    }

    // --- Initialization ---
    function initialize() {
        DOM_REACH.addBtn.addEventListener('click', addRow);
        DOM_REACH.inputBody.addEventListener('input', handleTableEvents);
        DOM_REACH.inputBody.addEventListener('click', handleTableEvents);

        // Re-render chart on theme change
        DOM_REACH.darkModeCheckbox.addEventListener('change', () => {
            if (!DOM_REACH.view.classList.contains('is-inactive')) {
                setTimeout(updateCalculationsAndRender, 50);
            }
        });

        // Start with two initial rows
        addRow();
        addRow();
    }

    initialize();
});