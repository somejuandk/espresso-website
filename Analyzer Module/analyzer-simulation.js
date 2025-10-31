// --- Simulation Modal Logic ---
function linearRegression(x, y) {
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for(let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumXX += x[i] * x[i];
    }
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return { slope: 0, intercept: sumY / n};
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

function showSimulationModal() {
    DOM.simulationModal.modal.classList.replace('hidden', 'flex');
    setTimeout(() => {
        DOM.simulationModal.backdrop.classList.add('open');
        DOM.simulationModal.content.classList.add('open');
        runSimulation();
    }, 10);
}

function hideSimulationModal() {
    if(simulationSpendTransactionsChart) simulationSpendTransactionsChart.destroy();
    if(simulationScatterChart) simulationScatterChart.destroy();
    if(simulationRevenueChart) simulationRevenueChart.destroy();
    if(simulationCpaChart) simulationCpaChart.destroy();
    if(simulationFutureRevenueChart) simulationFutureRevenueChart.destroy();
    if(simulationFutureCpaChart) simulationFutureCpaChart.destroy();
    simulationSpendTransactionsChart = null;
    simulationScatterChart = null;
    simulationRevenueChart = null;
    simulationCpaChart = null;
    simulationFutureRevenueChart = null;
    simulationFutureCpaChart = null;
    DOM.simulationModal.backdrop.classList.remove('open');
    DOM.simulationModal.content.classList.remove('open');
    setTimeout(() => DOM.simulationModal.modal.classList.replace('flex', 'hidden'), 300);
}

function runSimulation() {
    if(processedAnalyzerData.length < 2) return;

    const spendIncreasePercent = parseInt(DOM.simulationModal.spendSlider.value, 10);
    DOM.simulationModal.spendValue.textContent = `${spendIncreasePercent > 0 ? '+' : ''}${spendIncreasePercent}%`;

    const spendData = processedAnalyzerData.map(d => d.Spend);
    const revenueData = processedAnalyzerData.map(d => d.Revenue);
    const transactionsData = processedAnalyzerData.map(d => d.Transactions);

    const { slope: revSlope, intercept: revIntercept } = linearRegression(spendData, revenueData);
    const { slope: transSlope, intercept: transIntercept } = linearRegression(spendData, transactionsData);
    
    const totalSpend = spendData.reduce((a, b) => a + b, 0);
    const totalRevenue = revenueData.reduce((a, b) => a + b, 0);
    const totalTransactions = transactionsData.reduce((a, b) => a + b, 0);
    const numberOfDays = processedAnalyzerData.length;

    const newTotalSpend = totalSpend * (1 + spendIncreasePercent / 100);
    const predictedRevenue = revSlope * newTotalSpend + (revIntercept * numberOfDays);
    const predictedTransactions = transSlope * newTotalSpend + (transIntercept * numberOfDays);


    const currentMetrics = {
        'Spend': totalSpend, 'Revenue': totalRevenue, 'Transactions': totalTransactions,
        'AOV': totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        'ROAS': totalSpend > 0 ? totalRevenue / totalSpend : 0,
        'CPA': totalTransactions > 0 ? totalSpend / totalTransactions : 0,
    };

    const simulatedMetrics = {
        'Spend': newTotalSpend, 'Revenue': predictedRevenue, 'Transactions': predictedTransactions,
        'AOV': predictedTransactions > 0 ? predictedRevenue / predictedTransactions : 0,
        'ROAS': newTotalSpend > 0 ? predictedRevenue / newTotalSpend : 0,
        'CPA': predictedTransactions > 0 ? newTotalSpend / predictedTransactions : 0,
    };

    renderSimulationTable(currentMetrics, simulatedMetrics);
    renderEventMapper(currentMetrics, simulatedMetrics);
    renderSpendTransactionsChart();
    renderSimulationScatterPlot(spendData, revenueData, revSlope, revIntercept);
    renderProjectedLineCharts(revSlope, revIntercept, transSlope, transIntercept, spendIncreasePercent);
}

function renderSimulationTable(current, simulated) {
    const formatCurrency = (val) => `DKK ${val.toLocaleString('da-DK', {maximumFractionDigits: 0})}`;
    const formatNumber = (val, dec = 2) => val.toFixed(dec);
    const formatDelta = (currentVal, simulatedVal, isCPA = false) => {
        if (currentVal === 0) return `<span>-</span>`;
        const delta = ((simulatedVal - currentVal) / currentVal) * 100;
        const sign = delta >= 0 ? '+' : '';
        let colorClass = delta >= 0 ? 'delta-positive' : 'delta-negative';
        if (isCPA) colorClass = delta > 0 ? 'delta-negative' : 'delta-positive';

        return `<span class="${colorClass}">${sign}${formatNumber(delta, 1)}%</span>`;
    };

    const rows = [
        { metric: 'Spend', format: formatCurrency },
        { metric: 'Revenue', format: formatCurrency },
        { metric: 'Transactions', format: (v) => formatNumber(v, 0) },
        { metric: 'AOV', format: formatCurrency },
        { metric: 'ROAS', format: formatNumber },
        { metric: 'CPA', format: formatCurrency, isCPA: true },
    ];
    
    let tableHTML = `
        <table class="w-full text-sm text-left">
            <thead class="text-xs text-gray-500 uppercase">
                <tr><th class="py-3 px-4">Metric</th><th class="py-3 px-4">Current</th><th class="py-3 px-4">Simulated</th><th class="py-3 px-4">Delta</th></tr>
            </thead>
            <tbody>`;
    
    rows.forEach(({metric, format, isCPA}) => {
        tableHTML += `<tr class="border-b border-[#c8d2fe] dark:border-gray-700">
            <td class="py-3 px-4 font-medium text-gray-900">${metric}</td>
            <td class="py-3 px-4">${format(current[metric])}</td>
            <td class="py-3 px-4">${format(simulated[metric])}</td>
            <td class="py-3 px-4">${formatDelta(current[metric], simulated[metric], isCPA)}</td>
        </tr>`;
    });
    
    tableHTML += '</tbody></table>';
    DOM.simulationModal.resultsTable.innerHTML = tableHTML;
}

function renderEventMapper(current, simulated) {
    const spendDelta = simulated.Spend - current.Spend;
    const revenueDelta = simulated.Revenue - current.Revenue;
    const transactionsDelta = simulated.Transactions - current.Transactions;
    const formatCurrency = (val) => Math.abs(val).toLocaleString('da-DK', {maximumFractionDigits: 0});
    
    let events = [];
    const spendAction = spendDelta >= 0 ? 'increase' : 'decrease';
    events.push(`A <strong>${Math.abs(DOM.simulationModal.spendSlider.value)}%</strong> budget ${spendAction} could lead to:`);

    const revenueAction = revenueDelta >= 0 ? `an estimated <strong>${formatCurrency(revenueDelta)} DKK</strong> increase in revenue.` : `an estimated <strong>${formatCurrency(revenueDelta)} DKK</strong> decrease in revenue.`;
    events.push(`&bull; ${revenueAction}`);

    const transactionAction = transactionsDelta >= 0 ? `an estimated <strong>${transactionsDelta.toFixed(0)}</strong> additional transactions.` : `an estimated <strong>${Math.abs(transactionsDelta).toFixed(0)}</strong> fewer transactions.`;
    events.push(`&bull; ${transactionAction}`);
    
    DOM.simulationModal.eventMapper.innerHTML = events.map(e => `<p class="text-sm text-gray-800 dark:text-gray-300">${e}</p>`).join('');
}

function renderSpendTransactionsChart() {
    if(simulationSpendTransactionsChart) simulationSpendTransactionsChart.destroy();
    if (processedAnalyzerData.length === 0) return;
    const themeColors = getThemeColors();

    const spendData = processedAnalyzerData.map(d => d.Spend);
    const maxSpend = Math.max(...spendData);

    const bucketSize = Math.ceil(maxSpend / 12 / 500) * 500;
    if (bucketSize === 0) return;

    const buckets = new Map();

    processedAnalyzerData.forEach(day => {
        const bucketIndex = Math.floor(day.Spend / bucketSize);
        const bucketStart = bucketIndex * bucketSize;
        const bucketEnd = bucketStart + bucketSize;
        const label = `${bucketStart.toLocaleString('da-DK')} - ${bucketEnd.toLocaleString('da-DK')}`;

        if (!buckets.has(label)) {
            buckets.set(label, { transactions: 0, days: 0, start: bucketStart });
        }

        const bucket = buckets.get(label);
        bucket.transactions += day.Transactions;
        bucket.days++;
    });
    
    const sortedBuckets = [...buckets.entries()].sort((a, b) => a[1].start - b[1].start);

    const labels = sortedBuckets.map(entry => entry[0]);
    const transactionData = sortedBuckets.map(entry => entry[1].transactions);

    simulationSpendTransactionsChart = new Chart(DOM.simulationModal.spendTransactionsChartCanvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Total Transactions',
                data: transactionData,
                backgroundColor: themeColors.primaryRgba_Scatter,
                borderColor: themeColors.primary,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Daily Spend Bucket (DKK)', color: themeColors.ticks}, ticks: { color: themeColors.ticks, autoSkip: false, maxRotation: 45, minRotation: 45 }, grid: { display: false } },
                y: { title: { display: true, text: 'Total Transactions', color: themeColors.ticks}, ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }
            },
            plugins: { 
                legend: { display: false }, 
                title: { display: true, text: 'Transactions by Daily Spend', color: themeColors.title, font: {size: 14}},
                tooltip: {
                    callbacks: {
                        footer: function(tooltipItems) {
                             const bucketInfo = sortedBuckets[tooltipItems[0].dataIndex][1];
                             return `${bucketInfo.days} day(s) in this bucket.`;
                        }
                    }
                }
            }
        }
    });
}

function renderSimulationScatterPlot(spendData, revenueData, slope, intercept) {
    if(simulationScatterChart) simulationScatterChart.destroy();
    const themeColors = getThemeColors();
    
    const scatterData = spendData.map((spend, i) => ({x: spend, y: revenueData[i]}));
    const minSpend = Math.min(...spendData);
    const maxSpend = Math.max(...spendData);
    const trendlineData = [
        { x: minSpend, y: slope * minSpend + intercept },
        { x: maxSpend, y: slope * maxSpend + intercept }
    ];

    simulationScatterChart = new Chart(DOM.simulationModal.scatterPlotCanvas, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Daily Data',
                data: scatterData,
                backgroundColor: themeColors.primaryRgba_Scatter
            }, {
                label: 'Trendline',
                data: trendlineData,
                type: 'line',
                borderColor: themeColors.primary,
                borderWidth: 2,
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Daily Spend (DKK)', color: themeColors.ticks}, ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } },
                y: { title: { display: true, text: 'Daily Revenue (DKK)', color: themeColors.ticks}, ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }
            },
            plugins: { legend: { display: false }, title: { display: true, text: 'Spend vs. Revenue', color: themeColors.title, font: {size: 14}} }
        }
    });
}

function renderProjectedLineCharts(revSlope, revIntercept, transSlope, transIntercept, spendIncreasePercent) {
     const { aggregatedData, labels } = aggregateData(simulationTimeAggregation);
     const themeColors = getThemeColors();

     const renderChart = (metric, canvas, chartInstanceVar, useFutureLabels = false) => {
         if (window[chartInstanceVar]) window[chartInstanceVar].destroy();

         const getFutureLabels = (currentLabels) => {
             return currentLabels.map(label => {
                 const match = label.match(/(\d{4})/);
                 if (match) {
                     const year = parseInt(match[1], 10);
                     return label.replace(year, year + 1);
                 }
                 return label;
             });
         };
        
         const chartLabels = useFutureLabels ? getFutureLabels(labels) : labels;

         const projectedData = aggregatedData.map(d => {
             const projectedSpend = d.Spend * (1 + spendIncreasePercent / 100);
             const daysInPeriod = d.count || 1;
             
             if (metric === 'Revenue') {
                 return revSlope * projectedSpend + (revIntercept * daysInPeriod);
             }
             if (metric === 'CPA') {
                 const projectedTransactions = transSlope * projectedSpend + (transIntercept * daysInPeriod);
                 return projectedTransactions > 0 ? projectedSpend / projectedTransactions : 0;
             }
             return 0;
         });

         const datasets = [];
         if (!useFutureLabels) {
             const actualData = aggregatedData.map(d => d[metric]);
             datasets.push({
                 label: `Actual ${metric}`, data: actualData,
                 borderColor: themeColors.primary, backgroundColor: themeColors.primaryRgba,
                 fill: true, tension: 0.4
             });
         }
        
         datasets.push({
             label: `Projected ${metric}`, 
             data: projectedData,
             borderColor: useFutureLabels ? themeColors.primary : 'rgba(107, 114, 128, 0.8)', 
             backgroundColor: useFutureLabels ? themeColors.primaryRgba : 'rgba(107, 114, 128, 0.2)',
             borderDash: useFutureLabels ? [] : [5, 5], 
             fill: true, tension: 0.4
         });

         window[chartInstanceVar] = new Chart(canvas, {
             type: 'line',
             data: {
                 labels: chartLabels,
                 datasets: datasets
             },
             options: {
                 responsive: true, maintainAspectRatio: false,
                 scales: {
                     x: { ticks: { color: themeColors.ticks }, grid: { display: false } },
                     y: { ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }
                 },
                 plugins: { 
                     legend: { labels: { color: themeColors.legend } }, 
                     title: { 
                         display: true, 
                         text: `${useFutureLabels ? "Next Year's " : ""}Projected ${metric}`, 
                         color: themeColors.title, 
                         font: { size: 14 } 
                     } 
                 }
             }
         });
     };
    
     renderChart('Revenue', DOM.simulationModal.revenueChartCanvas, 'simulationRevenueChart');
     renderChart('CPA', DOM.simulationModal.cpaChartCanvas, 'simulationCpaChart');
     renderChart('Revenue', DOM.simulationModal.futureRevenueChartCanvas, 'simulationFutureRevenueChart', true);
     renderChart('CPA', DOM.simulationModal.futureCpaChartCanvas, 'simulationFutureCpaChart', true);
}

document.addEventListener('DOMContentLoaded', () => {
    if (DOM && DOM.analyzer && DOM.analyzer.simulationBtn) {
        DOM.analyzer.simulationBtn.addEventListener('click', showSimulationModal);
        DOM.simulationModal.closeBtn.addEventListener('click', hideSimulationModal);
        DOM.simulationModal.backdrop.addEventListener('click', hideSimulationModal);
    }
});