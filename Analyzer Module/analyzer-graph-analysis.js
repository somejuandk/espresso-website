// --- Graph Analysis Modal Logic ---
function showGraphAnalysisModal() {
    DOM.graphAnalysisModal.modal.classList.replace('hidden', 'flex');
    setTimeout(() => {
        DOM.graphAnalysisModal.backdrop.classList.add('open');
        DOM.graphAnalysisModal.content.classList.add('open');
        // Render charts after the modal is visible for better perceived performance
        renderAllAnalysisGraphs();
    }, 10);
}

function hideGraphAnalysisModal() {
    Object.values(graphAnalysisCharts).forEach(chart => { if(chart) chart.destroy(); });
    Object.keys(graphAnalysisCharts).forEach(key => graphAnalysisCharts[key] = null);
    DOM.graphAnalysisModal.backdrop.classList.remove('open');
    DOM.graphAnalysisModal.content.classList.remove('open');
    setTimeout(() => DOM.graphAnalysisModal.modal.classList.replace('flex', 'hidden'), 300);
}

function showEnlargedChart(chartId) {
    const storedCleanConfig = graphAnalysisCleanConfigs[chartId];
    if (!storedCleanConfig) {
        console.error("No clean configuration found for chart:", chartId, ". The chart cannot be enlarged.");
        return;
    }

    // By cloning the clean, stored config, we avoid issues with live chart instances.
    const newConfig = JSON.parse(JSON.stringify(storedCleanConfig));

    DOM.enlargeChartModal.title.textContent = newConfig.options.plugins.title.text;
    DOM.enlargeChartModal.modal.classList.replace('hidden', 'flex');

    setTimeout(() => {
        DOM.enlargeChartModal.backdrop.classList.add('open');
        DOM.enlargeChartModal.content.classList.add('open');

        const ctx = DOM.enlargeChartModal.canvas.getContext('2d');
        
        newConfig.options.maintainAspectRatio = false;
        if (newConfig.options.plugins && newConfig.options.plugins.title) {
             if (newConfig.options.plugins.title.font) {
                newConfig.options.plugins.title.font.size = 20;
             } else {
                newConfig.options.plugins.title.font = { size: 20 };
             }
        }

        if (enlargedChart) enlargedChart.destroy();
        
        enlargedChart = new Chart(ctx, newConfig);
    }, 10);
}


function hideEnlargedChart() {
    if (enlargedChart) enlargedChart.destroy();
    enlargedChart = null;
    DOM.enlargeChartModal.backdrop.classList.remove('open');
    DOM.enlargeChartModal.content.classList.remove('open');
    setTimeout(() => DOM.enlargeChartModal.modal.classList.replace('flex', 'hidden'), 300);
}

function renderAllAnalysisGraphs() {
    const { aggregatedData, labels } = aggregateData(graphAnalysisTimeAggregation);
    if (!aggregatedData || aggregatedData.length === 0) return;
    const themeColors = getThemeColors();

    const chartDefinitions = {
        'graph-spend-vs-revenue': {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Spend', data: aggregatedData.map(d => d.Spend), yAxisID: 'y', backgroundColor: themeColors.secondaryRgba },
                    { label: 'Revenue', data: aggregatedData.map(d => d.Revenue), yAxisID: 'y1', type: 'line', borderColor: themeColors.primary, tension: 0.4 }
                ]
            },
            options: { plugins: { title: { text: 'Spend vs. Revenue' } }, scales: { y: { position: 'left', title: { display: true, text: 'Spend (DKK)' } }, y1: { position: 'right', title: { display: true, text: 'Revenue (DKK)' }, grid: { display: false } } } }
        },
        'graph-spend-vs-transactions': {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Spend', data: aggregatedData.map(d => d.Spend), yAxisID: 'y', backgroundColor: themeColors.secondaryRgba },
                    { label: 'Transactions', data: aggregatedData.map(d => d.Transactions), yAxisID: 'y1', type: 'line', borderColor: themeColors.primary, tension: 0.4 }
                ]
            },
            options: { plugins: { title: { text: 'Spend vs. Transactions' } }, scales: { y: { position: 'left', title: { display: true, text: 'Spend (DKK)' } }, y1: { position: 'right', title: { display: true, text: 'Transactions' }, grid: { display: false } } } }
        },
        'graph-wow-spend': { type: 'bar', data: { labels, datasets: [{ label: 'Spend', data: aggregatedData.map(d => d.Spend), backgroundColor: themeColors.primaryRgba_Bar }] }, options: { plugins: { title: { text: 'Spend' } }, scales: { y: { title: { display: true, text: 'Spend (DKK)' } } } } },
        'graph-wow-revenue': { type: 'bar', data: { labels, datasets: [{ label: 'Revenue', data: aggregatedData.map(d => d.Revenue), backgroundColor: themeColors.primaryRgba_Bar }] }, options: { plugins: { title: { text: 'Revenue' } }, scales: { y: { title: { display: true, text: 'Revenue (DKK)' } } } } },
        'graph-wow-transactions': { type: 'bar', data: { labels, datasets: [{ label: 'Transactions', data: aggregatedData.map(d => d.Transactions), backgroundColor: themeColors.primaryRgba_Bar }] }, options: { plugins: { title: { text: 'Transactions' } }, scales: { y: { title: { display: true, text: 'Transactions' } } } } },
        'graph-wow-roas': { type: 'bar', data: { labels, datasets: [{ label: 'ROAS', data: aggregatedData.map(d => d.ROAS), backgroundColor: themeColors.primaryRgba_Bar }] }, options: { plugins: { title: { text: 'ROAS' } }, scales: { y: { title: { display: true, text: 'ROAS' } } } } },
        'graph-wow-aov': { type: 'bar', data: { labels, datasets: [{ label: 'AOV', data: aggregatedData.map(d => d.AOV), backgroundColor: themeColors.primaryRgba_Bar }] }, options: { plugins: { title: { text: 'AOV' } }, scales: { y: { title: { display: true, text: 'AOV (DKK)' } } } } },
        'graph-wow-cpa': { type: 'bar', data: { labels, datasets: [{ label: 'CPA', data: aggregatedData.map(d => d.CPA), backgroundColor: themeColors.dangerRgba_Bar }] }, options: { plugins: { title: { text: 'CPA' } }, scales: { y: { title: { display: true, text: 'CPA (DKK)' } } } } }
    };

    for (const id in chartDefinitions) {
        if (graphAnalysisCharts[id]) graphAnalysisCharts[id].destroy();
        const canvas = document.getElementById(id);
        if (canvas) {
            const chartConfig = chartDefinitions[id];
            
            if (!graphAnalysisChartTypes[id]) graphAnalysisChartTypes[id] = chartConfig.type;
            const currentChartType = graphAnalysisChartTypes[id];

            const baseOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: chartConfig.data.datasets.length > 1, labels: { color: themeColors.legend } },
                    title: { display: true, color: themeColors.title, font: { size: 16 } }
                },
                scales: {
                    x: { ticks: { color: themeColors.ticks, autoSkip: true, maxTicksLimit: 10 }, grid: { color: themeColors.grid } }
                }
            };
            
            const finalOptions = {
                ...baseOptions,
                ...chartConfig.options,
                plugins: { ...baseOptions.plugins, ...chartConfig.options.plugins },
                scales: { ...baseOptions.scales, ...chartConfig.options.scales }
            };

            Object.keys(finalOptions.scales).forEach(key => {
                if (key.startsWith('y')) {
                    finalOptions.scales[key].ticks = { ...finalOptions.scales[key].ticks, color: themeColors.ticks };
                    finalOptions.scales[key].grid = { ...finalOptions.scales[key].grid, color: themeColors.grid };
                    if (finalOptions.scales[key].title) {
                        finalOptions.scales[key].title.color = themeColors.ticks;
                    }
                }
            });
            
            if(currentChartType === 'line' && chartConfig.type === 'bar') {
                chartConfig.data.datasets.forEach(ds => {
                    ds.borderColor = ds.label === 'CPA' ? themeColors.danger : themeColors.primary;
                    ds.backgroundColor = ds.label === 'CPA' ? themeColors.dangerRgba : themeColors.primaryRgba;
                    ds.tension = 0.4;
                    ds.fill = true;
                });
            }

            const finalConfig = {
                type: currentChartType,
                data: chartConfig.data,
                options: finalOptions
            };

            try {
                graphAnalysisCleanConfigs[id] = JSON.parse(JSON.stringify(finalConfig));
            } catch (e) {
                console.error("Could not create a clean config for chart:", id, e);
                graphAnalysisCleanConfigs[id] = null;
            }

            graphAnalysisCharts[id] = new Chart(canvas, finalConfig);
        }
    }
}

function rerenderSingleAnalysisGraph(chartId) {
     const { aggregatedData, labels } = aggregateData(graphAnalysisTimeAggregation);
    if (!aggregatedData || aggregatedData.length === 0) return;
    const themeColors = getThemeColors();

    if (graphAnalysisCharts[chartId]) {
        graphAnalysisCharts[chartId].destroy();
    }
    
    const canvas = document.getElementById(chartId);
    const chartType = graphAnalysisChartTypes[chartId];
    
    let data, options;

    switch (chartId) {
        case 'graph-wow-spend':
            data = { labels, datasets: [{ label: 'Spend', data: aggregatedData.map(d => d.Spend) }] };
            options = { plugins: { title: { text: 'Spend' } }, scales: { y: { title: { display: true, text: 'Spend (DKK)' } } } };
            break;
        case 'graph-wow-revenue':
            data = { labels, datasets: [{ label: 'Revenue', data: aggregatedData.map(d => d.Revenue) }] };
            options = { plugins: { title: { text: 'Revenue' } }, scales: { y: { title: { display: true, text: 'Revenue (DKK)' } } } };
            break;
        case 'graph-wow-transactions':
             data = { labels, datasets: [{ label: 'Transactions', data: aggregatedData.map(d => d.Transactions) }] };
             options = { plugins: { title: { text: 'Transactions' } }, scales: { y: { title: { display: true, text: 'Transactions' } } } };
            break;
        case 'graph-wow-roas':
            data = { labels, datasets: [{ label: 'ROAS', data: aggregatedData.map(d => d.ROAS) }] };
            options = { plugins: { title: { text: 'ROAS' } }, scales: { y: { title: { display: true, text: 'ROAS' } } } };
            break;
        case 'graph-wow-aov':
             data = { labels, datasets: [{ label: 'AOV', data: aggregatedData.map(d => d.AOV) }] };
             options = { plugins: { title: { text: 'AOV' } }, scales: { y: { title: { display: true, text: 'AOV (DKK)' } } } };
            break;
        case 'graph-wow-cpa':
             data = { labels, datasets: [{ label: 'CPA', data: aggregatedData.map(d => d.CPA) }] };
             options = { plugins: { title: { text: 'CPA' } }, scales: { y: { title: { display: true, text: 'CPA (DKK)' } } } };
             break;
        default:
            return;
    }
    
    data.datasets.forEach(ds => {
        if (chartType === 'line') {
            ds.borderColor = ds.label === 'CPA' ? themeColors.danger : themeColors.primary;
            ds.backgroundColor = ds.label === 'CPA' ? themeColors.dangerRgba : themeColors.primaryRgba;
            ds.tension = 0.4;
            ds.fill = true;
        } else {
            ds.backgroundColor = ds.label === 'CPA' ? themeColors.dangerRgba_Bar : themeColors.primaryRgba_Bar;
        }
    });

    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false, labels: { color: themeColors.legend } },
            title: { display: true, color: themeColors.title, font: { size: 16 } }
        },
        scales: {
            x: { ticks: { color: themeColors.ticks, autoSkip: true, maxTicksLimit: 10 }, grid: { color: themeColors.grid } }
        }
    };
    
    const finalOptions = {
        ...baseOptions,
        ...options,
        plugins: { ...baseOptions.plugins, ...options.plugins },
        scales: { ...baseOptions.scales, ...options.scales }
    };
    if (finalOptions.scales.y) {
        finalOptions.scales.y.ticks = { ...finalOptions.scales.y.ticks, color: themeColors.ticks };
        finalOptions.scales.y.grid = { ...finalOptions.scales.y.grid, color: themeColors.grid };
         if(finalOptions.scales.y.title) finalOptions.scales.y.title.color = themeColors.ticks;
    }

    graphAnalysisCharts[chartId] = new Chart(canvas, {
        type: chartType,
        data: data,
        options: finalOptions
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (DOM && DOM.analyzer && DOM.analyzer.graphAnalysisBtn) {
        DOM.analyzer.graphAnalysisBtn.addEventListener('click', showGraphAnalysisModal);
        DOM.graphAnalysisModal.closeBtn.addEventListener('click', hideGraphAnalysisModal);
        DOM.graphAnalysisModal.backdrop.addEventListener('click', hideGraphAnalysisModal);
    }
});