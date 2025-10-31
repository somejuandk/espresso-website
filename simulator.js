// --- Global Functions for Simulator ---
let simulatorRawData = [];
let simulatorProcessedData = [];
let revenueScatterChart = null;
let transactionsScatterChart = null;
let simulatorTimeAggregation = 'Daily';
let spendTransactionsChart = null;
let revenueChart = null;
let cpaChart = null;
let futureRevenueChart = null;
let futureCpaChart = null;

function handleSimulatorFileContent(csvText, filename) {
    try {
        parseAndProcessSimulatorCsv(csvText); // Use module-specific function
        addToFileLibrary({ name: filename, content: csvText, context: 'Performance Simulator' });
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
        resetSimulatorView();
    }
}

function handleSimulatorFile(file) {
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
        const reader = new FileReader();
        reader.onload = (e) => {
            handleSimulatorFileContent(e.target.result, file.name);
        };
        reader.readAsText(file);
    } else {
        showNotification('Please upload a valid .csv file.', 'error');
    }
}

function parseAndProcessSimulatorCsv(csvText) { // Renamed from parseAndProcessCsv
    const rows = csvText.split('\n').filter(row => row.trim() !== '');
    if (rows.length < 2) {
        throw new Error("CSV file is empty or invalid.");
    }
    
    const header = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const metricAliases = {
        'Day': ['Day', 'Date', 'Reporting starts'],
        'Spend': ['Amount spent (DKK)', 'Spend', 'Cost', 'Amount Spent'],
        'Revenue': ['Website purchase conversion value', 'Purchase conversion value', 'Purchases conversion value', 'Conv. value', 'Total conversion value'],
        'Transactions': ['Purchases', 'Conversions', 'Website purchases'],
    };

    const standardToAlias = {};
    for (const standardName in metricAliases) {
        for (const alias of metricAliases[standardName]) {
            standardToAlias[alias.toLowerCase()] = standardName;
        }
    }

    const headerMapping = {};
    let dayIndex = -1;

    header.forEach((col, index) => {
        const lowerCol = col.toLowerCase();
        const standardName = standardToAlias[lowerCol];
        if (standardName) {
            headerMapping[index] = standardName;
            if (standardName === 'Day' && dayIndex === -1) {
                dayIndex = index;
            }
        }
    });
    
    if (dayIndex === -1 || !Object.values(headerMapping).includes('Spend') || !Object.values(headerMapping).includes('Revenue') || !Object.values(headerMapping).includes('Transactions')) {
        throw new Error("CSV must contain columns for Day, Spend, Revenue, and Transactions.");
    }

    simulatorRawData = rows.slice(1).map(row => {
        const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        if (values.length < header.length) return null;

        const dayString = values[dayIndex];
        if (!dayString || isNaN(new Date(dayString))) return null;

        const rowData = { 'Day': dayString };

        for (const indexStr in headerMapping) {
            const index = parseInt(indexStr, 10);
            const metricName = headerMapping[index];

            if (metricName === 'Day') {
                continue;
            }
            
            const rawValue = values[index];
            const numValue = parseFloat(String(rawValue).replace(/[^0-9.]/g, ''));
            if (!isNaN(numValue)) {
                rowData[metricName] = numValue;
            }
        }
        return rowData;
    }).filter(Boolean).sort((a, b) => new Date(a.Day) - new Date(b.Day));
    
    if (simulatorRawData.length === 0) throw new Error("No valid data rows found in CSV.");

    document.dispatchEvent(new CustomEvent('simulatorDataProcessed'));
}


document.addEventListener('DOMContentLoaded', () => {
    // Check if dependencies from script.js are loaded
    if (typeof getThemeColors !== 'function' || typeof showNotification !== 'function' || typeof throttle !== 'function') {
        console.error("Simulator app requires getThemeColors, showNotification, and throttle from script.js");
        return;
    }

    // --- DOM Elements ---
    const SIMULATOR_DOM = {
        view: document.getElementById('simulator-view'),
        fileInput: document.getElementById('simulator-file-input'),
        dropZone: document.getElementById('simulator-file-drop-zone'),
        mainContent: document.getElementById('simulator-main-content'),
        spendSlider: document.getElementById('simulator-spend-increase-slider'),
        spendValue: document.getElementById('simulator-spend-increase-value'),
        summaryTable: document.getElementById('simulator-summary-table'),
        eventMapper: document.getElementById('simulator-event-mapper'),
        revenueScatterCanvas: document.getElementById('simulator-revenue-scatter-plot'),
        transactionsScatterCanvas: document.getElementById('simulator-transactions-scatter-plot'),
        darkModeCheckbox: document.getElementById('dark-mode-checkbox'),
        timeAggControls: document.getElementById('simulator-time-aggregation-controls'),
        spendTransactionsChartCanvas: document.getElementById('simulator-spend-transactions-chart'),
        revenueChartCanvas: document.getElementById('simulator-revenue-chart'),
        cpaChartCanvas: document.getElementById('simulator-cpa-chart'),
        futureRevenueChartCanvas: document.getElementById('simulator-future-revenue-chart'),
        futureCpaChartCanvas: document.getElementById('simulator-future-cpa-chart'),
    };
    
    if (!SIMULATOR_DOM.view) return;

    window.fileHandlers.simulator = handleSimulatorFileContent;
    document.addEventListener('simulatorDataProcessed', processData);
    
    // --- UTILITY ---
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }

    function handleFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        SIMULATOR_DOM.dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleSimulatorFile(files[0]);
        }
    }

    function processData() {
        simulatorProcessedData = simulatorRawData.map(d => {
            const spend = d['Spend'] || 0;
            const revenue = d['Revenue'] || 0;
            const transactions = d['Transactions'] || 0;
            return {
                'Spend': spend,
                'Revenue': revenue,
                'Transactions': transactions,
                'AOV': transactions > 0 ? revenue / transactions : 0,
                'ROAS': spend > 0 ? revenue / spend : 0,
                'CPA': transactions > 0 ? spend / transactions : 0,
            };
        });

        // Update UI after processing
        SIMULATOR_DOM.dropZone.classList.add('hidden');
        SIMULATOR_DOM.mainContent.classList.remove('hidden');
        showNotification(`${simulatorRawData.length} rows processed successfully.`, 'success');
        
        runAndRenderSimulation();
    }
    
    // --- Simulation Logic ---
     function aggregateData(period) {
        if (simulatorRawData.length === 0) return { aggregatedData: [], labels: [] };
        
        if (period === 'Daily') {
            return {
                aggregatedData: simulatorProcessedData.map((d, i) => ({...d, count: 1})),
                labels: simulatorRawData.map(d => formatDate(d.Day))
            };
        }

        const groupedData = {};
        simulatorRawData.forEach((row, index) => {
            const date = new Date(row.Day);
            let key;
            if (period === 'Weekly') {
                const weekStart = new Date(date);
                weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay() + (date.getUTCDay() === 0 ? -6 : 1));
                weekStart.setUTCHours(0,0,0,0);
                key = weekStart.toISOString().split('T')[0];
            } else { // Monthly
                key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            }

            if (!groupedData[key]) {
                groupedData[key] = { ...Object.keys(simulatorProcessedData[0]).reduce((acc, k) => ({...acc, [k]: 0}), {}), count: 0,
                    label: period === 'Weekly' ? `Wk of ${formatDate(key)}` : new Date(date.getUTCFullYear(), date.getUTCMonth()).toLocaleDateString('en-US', { month: 'short', year: 'numeric'})
                };
            }
            
            const group = groupedData[key];
            for(const metric in simulatorProcessedData[index]) {
                    group[metric] += simulatorProcessedData[index][metric];
            }
            group.count++;
        });

        const labels = Object.values(groupedData).map(g => g.label).sort((a,b) => new Date(a.replace('Wk of ','')) - new Date(b.replace('Wk of ','')));
        const aggregatedData = Object.values(groupedData).map(g => {
            const aggregatedRow = {};
            // Sum basic metrics
            aggregatedRow.Spend = g.Spend;
            aggregatedRow.Revenue = g.Revenue;
            aggregatedRow.Transactions = g.Transactions;
            // Recalculate derived metrics
            aggregatedRow.AOV = g.Transactions > 0 ? g.Revenue / g.Transactions : 0;
            aggregatedRow.ROAS = g.Spend > 0 ? g.Revenue / g.Spend : 0;
            aggregatedRow.CPA = g.Transactions > 0 ? g.Spend / g.Transactions : 0;
            aggregatedRow.count = g.count;
            aggregatedRow.label = g.label;
            return aggregatedRow;
        }).sort((a,b) => new Date(a.label.replace('Wk of ','')) - new Date(b.label.replace('Wk of ','')));

        return { aggregatedData, labels };
    }


    function linearRegression(x, y) {
        const n = x.length;
        if (n < 2) return { slope: 0, intercept: 0 };
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for(let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumXX += x[i] * x[i];
        }
        const denominator = (n * sumXX - sumX * sumX);
        if (denominator === 0) return { slope: 0, intercept: sumY / n };
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        return { slope, intercept };
    }

    function runAndRenderSimulation() {
        if (simulatorProcessedData.length < 2) return;

        const spendIncreasePercent = parseInt(SIMULATOR_DOM.spendSlider.value, 10);
        SIMULATOR_DOM.spendValue.textContent = `${spendIncreasePercent > 0 ? '+' : ''}${spendIncreasePercent}%`;

        // Regression should always be on daily data for best accuracy
        const spendData = simulatorProcessedData.map(d => d.Spend);
        const revenueData = simulatorProcessedData.map(d => d.Revenue);
        const transactionsData = simulatorProcessedData.map(d => d.Transactions);

        const { slope: revSlope, intercept: revIntercept } = linearRegression(spendData, revenueData);
        const { slope: transSlope, intercept: transIntercept } = linearRegression(spendData, transactionsData);
        
        const totalSpend = spendData.reduce((a, b) => a + b, 0);
        const totalRevenue = revenueData.reduce((a, b) => a + b, 0);
        const totalTransactions = transactionsData.reduce((a, b) => a + b, 0);
        const numberOfDays = simulatorProcessedData.length;

        const newTotalSpend = totalSpend * (1 + spendIncreasePercent / 100);
        // Use the regression model: y = mx + b. For totals, we multiply intercept by n days.
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
        renderScatterPlots(spendData, revenueData, transactionsData, revSlope, revIntercept, transSlope, transIntercept);
        renderSpendTransactionsChart();
        renderProjectedLineCharts(revSlope, revIntercept, transSlope, transIntercept, spendIncreasePercent);
    }
    
    // --- UI Rendering ---

    function resetSimulatorView() {
        SIMULATOR_DOM.dropZone.classList.remove('hidden', 'upload-success');
         SIMULATOR_DOM.dropZone.innerHTML = `
            <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4 4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            <p class="mt-4 text-sm text-gray-600"><span class="font-semibold text-[#5248e2]">Upload a file</span> or drag and drop</p>
            <p class="text-xs text-gray-500">CSV files exported from Meta Ads</p>
        `;
        SIMULATOR_DOM.mainContent.classList.add('hidden');

        const chartsToDestroy = [revenueScatterChart, transactionsScatterChart, spendTransactionsChart, revenueChart, cpaChart, futureRevenueChart, futureCpaChart];
        chartsToDestroy.forEach(chart => {
            if (chart) chart.destroy();
        });
        
        revenueScatterChart = null;
        transactionsScatterChart = null;
        spendTransactionsChart = null;
        revenueChart = null;
        cpaChart = null;
        futureRevenueChart = null;
        futureCpaChart = null;
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
            tableHTML += `<tr class="border-b border-gray-200/50 dark:border-gray-700">
                <td class="py-3 px-4 font-medium text-gray-900">${metric}</td>
                <td class="py-3 px-4">${format(current[metric])}</td>
                <td class="py-3 px-4">${format(simulated[metric])}</td>
                <td class="py-3 px-4">${formatDelta(current[metric], simulated[metric], isCPA)}</td>
            </tr>`;
        });
        
        tableHTML += '</tbody></table>';
        SIMULATOR_DOM.summaryTable.innerHTML = tableHTML;
    }

    function renderEventMapper(current, simulated) {
        const spendDelta = simulated.Spend - current.Spend;
        const revenueDelta = simulated.Revenue - current.Revenue;
        const transactionsDelta = simulated.Transactions - current.Transactions;
        const formatCurrency = (val) => Math.abs(val).toLocaleString('da-DK', {maximumFractionDigits: 0});
        
        let events = [];
        const spendAction = spendDelta >= 0 ? 'increase' : 'decrease';
        events.push(`A <strong>${Math.abs(SIMULATOR_DOM.spendSlider.value)}%</strong> budget ${spendAction} could lead to:`);

        const revenueAction = revenueDelta >= 0 ? `an estimated <strong>${formatCurrency(revenueDelta)} DKK</strong> increase in revenue.` : `an estimated <strong>${formatCurrency(revenueDelta)} DKK</strong> decrease in revenue.`;
        events.push(`&bull; ${revenueAction}`);

        const transactionAction = transactionsDelta >= 0 ? `an estimated <strong>${transactionsDelta.toFixed(0)}</strong> additional transactions.` : `an estimated <strong>${Math.abs(transactionsDelta).toFixed(0)}</strong> fewer transactions.`;
        events.push(`&bull; ${transactionAction}`);
        
        SIMULATOR_DOM.eventMapper.innerHTML = events.map(e => `<p class="text-sm text-gray-800 dark:text-gray-300">${e}</p>`).join('');
    }

    function renderScatterPlots(spendData, revenueData, transactionsData, revSlope, revIntercept, transSlope, transIntercept) {
        const themeColors = getThemeColors();
        
        const renderScatter = (canvas, chartInstanceRef, xData, yData, slope, intercept, title, yLabel) => {
            if (chartInstanceRef.chart) chartInstanceRef.chart.destroy();
            
            const scatterData = xData.map((d, i) => ({x: d, y: yData[i]}));
            const minX = Math.min(...xData);
            const maxX = Math.max(...xData);
            const trendlineData = [
                { x: minX, y: slope * minX + intercept },
                { x: maxX, y: slope * maxX + intercept }
            ];

            chartInstanceRef.chart = new Chart(canvas, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Daily Data', data: scatterData,
                        backgroundColor: themeColors.primaryRgba_Scatter
                    }, {
                        label: 'Trendline', data: trendlineData, type: 'line',
                        borderColor: themeColors.primary, borderWidth: 2, fill: false, pointRadius: 0
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'Daily Spend (DKK)', color: themeColors.ticks}, ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } },
                        y: { title: { display: true, text: yLabel, color: themeColors.ticks}, ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }
                    },
                    plugins: { legend: { display: false }, title: { display: true, text: title, color: themeColors.title, font: {size: 16}} }
                }
            });
        };
        
        const revenueChartRef = { chart: revenueScatterChart };
        renderScatter(SIMULATOR_DOM.revenueScatterCanvas, revenueChartRef, spendData, revenueData, revSlope, revIntercept, 'Daily Spend vs. Revenue', 'Daily Revenue (DKK)');
        revenueScatterChart = revenueChartRef.chart;

        const transChartRef = { chart: transactionsScatterChart };
        renderScatter(SIMULATOR_DOM.transactionsScatterCanvas, transChartRef, spendData, transactionsData, transSlope, transIntercept, 'Daily Spend vs. Transactions', 'Daily Transactions');
        transactionsScatterChart = transChartRef.chart;
    }
    
    function renderSpendTransactionsChart() {
        if(spendTransactionsChart) spendTransactionsChart.destroy();
        if (simulatorProcessedData.length === 0) return;
        const themeColors = getThemeColors();

        const spendData = simulatorProcessedData.map(d => d.Spend);
        const maxSpend = Math.max(...spendData);

        const bucketSize = Math.ceil(maxSpend / 12 / 500) * 500;
        if (bucketSize === 0) return;

        const buckets = new Map();

        simulatorProcessedData.forEach(day => {
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

        spendTransactionsChart = new Chart(SIMULATOR_DOM.spendTransactionsChartCanvas, {
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

    function renderProjectedLineCharts(revSlope, revIntercept, transSlope, transIntercept, spendIncreasePercent) {
        const { aggregatedData, labels } = aggregateData(simulatorTimeAggregation);
        const themeColors = getThemeColors();

        const renderChart = (metric, canvas, chartInstanceRef, useFutureLabels = false) => {
            if (chartInstanceRef.chart) chartInstanceRef.chart.destroy();

            const getFutureLabels = (currentLabels) => {
                return currentLabels.map(label => {
                    const match = label.match(/(\d{4})/);
                    if (match) {
                        const year = parseInt(match[1], 10);
                        return label.replace(year, year + 1);
                    }
                    return `Next Year ${label}`;
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

            chartInstanceRef.chart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: datasets
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { color: themeColors.ticks, autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } },
                        y: { ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }
                    },
                    plugins: { legend: { labels: { color: themeColors.legend } }, title: { display: true, text: `${useFutureLabels ? "Next Year's " : ""}Projected ${metric}`, color: themeColors.title, font: { size: 14 } } }
                }
            });
        };

       const chartRefs = {
           revenue: { chart: revenueChart },
           cpa: { chart: cpaChart },
           futureRevenue: { chart: futureRevenueChart },
           futureCpa: { chart: futureCpaChart }
       };

       renderChart('Revenue', SIMULATOR_DOM.revenueChartCanvas, chartRefs.revenue);
       renderChart('CPA', SIMULATOR_DOM.cpaChartCanvas, chartRefs.cpa);
       renderChart('Revenue', SIMULATOR_DOM.futureRevenueChartCanvas, chartRefs.futureRevenue, true);
       renderChart('CPA', SIMULATOR_DOM.futureCpaChartCanvas, chartRefs.futureCpa, true);

       revenueChart = chartRefs.revenue.chart;
       cpaChart = chartRefs.cpa.chart;
       futureRevenueChart = chartRefs.futureRevenue.chart;
       futureCpaChart = chartRefs.futureCpa.chart;
   }

    // --- Event Listeners ---
    function setupEventListeners() {
        SIMULATOR_DOM.dropZone.addEventListener('click', () => SIMULATOR_DOM.fileInput.click());
        SIMULATOR_DOM.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleSimulatorFile(e.target.files[0]);
            e.target.value = ''; // Reset input
        });
        SIMULATOR_DOM.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); SIMULATOR_DOM.dropZone.classList.add('dragover'); });
        SIMULATOR_DOM.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); SIMULATOR_DOM.dropZone.classList.remove('dragover'); });
        SIMULATOR_DOM.dropZone.addEventListener('drop', handleFileDrop);

        const throttledSimulation = throttle(runAndRenderSimulation, 150);
        SIMULATOR_DOM.spendSlider.addEventListener('input', throttledSimulation);

        SIMULATOR_DOM.timeAggControls.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && !button.classList.contains('active')) {
                SIMULATOR_DOM.timeAggControls.querySelector('.active').classList.remove('active');
                button.classList.add('active');
                simulatorTimeAggregation = button.dataset.period;
                runAndRenderSimulation();
            }
        });

        // Re-render charts on theme change
        SIMULATOR_DOM.darkModeCheckbox.addEventListener('change', () => {
            if (!SIMULATOR_DOM.view.classList.contains('is-inactive') && simulatorProcessedData.length > 0) {
                setTimeout(runAndRenderSimulation, 50);
            }
        });
    }

    setupEventListeners();
});