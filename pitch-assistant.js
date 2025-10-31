// --- Global Functions for Pitch Assistant ---
let pitchData = [];
let processedPitchData = [];
const pitchCharts = {};
let generatedTakeaways = [];
let takeawayDetailsChart = null;

function handlePitchFileContent(csvText, filename) {
    try {
        parseAndProcessPitchCsv(csvText); // Use module-specific function
        addToFileLibrary({ name: filename, content: csvText, context: 'Pitch Assistant' });
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function handlePitchFile(file) {
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
        const reader = new FileReader();
        reader.onload = (e) => {
            handlePitchFileContent(e.target.result, file.name);
        };
        reader.readAsText(file);
    } else {
        showNotification('Please upload a valid .csv file.', 'error');
    }
}

function parseAndProcessPitchCsv(csvText) { // Renamed from parseAndProcessCsv
    const rows = csvText.split('\n').filter(row => row.trim() !== '');
    if (rows.length < 2) throw new Error("CSV has no data rows.");

    const header = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const metricAliases = {
        'Day': ['Day', 'Date', 'Reporting starts'],
        'Spend': ['Amount spent (DKK)', 'Spend', 'Cost', 'Amount Spent'],
        'Revenue': ['Website purchase conversion value', 'Purchase conversion value', 'Purchases conversion value', 'Conv. value', 'Total conversion value'],
        'Transactions': ['Purchases', 'Conversions', 'Website purchases'],
        'Impressions': ['Impressions', 'Impr.'],
        'Link Clicks': ['Link clicks', 'Clicks'],
        'Reach': ['Reach'],
        'CTR (%)': ['CTR (link click-through rate)', 'CTR', 'CTR (all)'],
        'CPM': ['CPM (cost per 1,000 impressions)'],
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

    const requiredMetrics = ['Day', 'Spend', 'Revenue', 'Transactions', 'Impressions', 'Link Clicks', 'Reach'];
    const foundMetrics = Object.values(headerMapping);
    if (!requiredMetrics.every(m => foundMetrics.includes(m))) {
        throw new Error("CSV is missing required columns (Day, Spend, Revenue, Transactions, etc.).");
    }

    pitchData = rows.slice(1).map(row => {
        const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        if (values.length < header.length) return null;

        const dayString = values[dayIndex];
        if (!dayString) return null;
        const date = new Date(dayString);
        if (isNaN(date)) return null;

        const rowData = { 'Day': date.toISOString().split('T')[0] };

        for (const indexStr in headerMapping) {
            const index = parseInt(indexStr, 10);
            const metricName = headerMapping[index];
            
            if (metricName === 'Day') {
                continue;
            }

            const rawValue = values[index] || '0';
            const numValue = parseFloat(String(rawValue).replace(/[^0-9.]/g, ''));
            if (!isNaN(numValue)) {
                rowData[metricName] = numValue;
            }
        }
        return rowData;
    }).filter(Boolean).sort((a, b) => new Date(a.Day) - new Date(b.Day));

    if (pitchData.length === 0) throw new Error("No valid data rows found in CSV.");

    processedPitchData = pitchData.map(d => {
        const spend = d.Spend || 0;
        const revenue = d.Revenue || 0;
        const transactions = d.Transactions || 0;
        const impressions = d.Impressions || 0;
        const linkClicks = d['Link Clicks'] || 0;
        const reach = d.Reach || 0;
        return {
            Day: d.Day,
            Spend: spend,
            Revenue: revenue,
            Transactions: transactions,
            ROAS: spend > 0 ? revenue / spend : 0,
            CPA: transactions > 0 ? spend / transactions : 0,
            AOV: transactions > 0 ? revenue / transactions : 0,
            'CTR (%)': impressions > 0 ? (linkClicks / impressions) * 100 : 0,
            CPM: impressions > 0 ? (spend / impressions) * 1000 : 0,
            Impressions: impressions,
            'Link Clicks': linkClicks,
            Reach: reach
        };
    });
    
    showNotification(`${pitchData.length} days of data processed.`, 'success');
    document.dispatchEvent(new CustomEvent('pitchDataProcessed'));
}

document.addEventListener('DOMContentLoaded', () => {
    // Check for dependencies from script.js
    if (typeof getThemeColors !== 'function' || typeof showNotification !== 'function' || typeof correl !== 'function') {
        console.error("Pitch Assistant app requires dependencies from script.js");
        return;
    }

    const PITCH_DOM = {
        view: document.getElementById('pitch-assistant-view'),
        uploadContainer: document.getElementById('pitch-upload-container'),
        fileInput: document.getElementById('pitch-file-input'),
        dropZone: document.getElementById('pitch-file-drop-zone'),
        mainContent: document.getElementById('pitch-main-content'),
        keyMetricsContainer: document.getElementById('pitch-key-metrics'),
        takeawaysList: document.getElementById('pitch-takeaways-list'),
        performanceChart: document.getElementById('pitch-performance-chart'),
        efficiencyChart: document.getElementById('pitch-efficiency-chart'),
        scatterChart: document.getElementById('pitch-scatter-chart'),
        weeklySpendChart: document.getElementById('pitch-weekly-spend-chart'),
        darkModeCheckbox: document.getElementById('dark-mode-checkbox'),
        exportBtn: document.getElementById('pitch-export-btn'),
        popSelect: document.getElementById('pitch-pop-select'),
        popMetricsContainer: document.getElementById('pitch-pop-metrics'),
        dowSelect: document.getElementById('pitch-dow-select'),
        dowChart: document.getElementById('pitch-dow-chart'),
        takeawayDetails: {
            modal: document.getElementById('takeaway-details-modal'),
            backdrop: document.getElementById('takeaway-details-backdrop'),
            content: document.getElementById('takeaway-details-content'),
            closeBtn: document.getElementById('takeaway-details-close-btn'),
            title: document.getElementById('takeaway-details-title'),
            description: document.getElementById('takeaway-details-description'),
            chartCanvas: document.getElementById('takeaway-details-chart'),
        }
    };

    if (!PITCH_DOM.view) return;
    
    window.fileHandlers['pitch-assistant'] = handlePitchFileContent;

    function linearRegression(x, y) {
        const n = x.length;
        if (n < 2) return { slope: 0, intercept: 0 };
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumXX += x[i] * x[i];
        }
        const denominator = (n * sumXX - sumX * sumX);
        if (denominator === 0) return { slope: 0, intercept: 0 };
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        return { slope, intercept };
    }

    function handleFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        PITCH_DOM.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handlePitchFile(e.dataTransfer.files[0]);
        }
    }
    
    function getWeeklyAggregates(data) {
        const weeklyData = {};
        data.forEach(d => {
            const date = new Date(d.Day);
            const dayOfWeek = date.getUTCDay();
            const dateOnly = new Date(date.setUTCHours(0, 0, 0, 0));
            dateOnly.setUTCDate(dateOnly.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Set to Monday
            const weekStart = dateOnly.toISOString().split('T')[0];
    
            if (!weeklyData[weekStart]) {
                weeklyData[weekStart] = {
                    Spend: 0, Revenue: 0, Transactions: 0, 'Link Clicks': 0, Impressions: 0, days: 0, weekStart: weekStart
                };
            }
            weeklyData[weekStart].Spend += d.Spend;
            weeklyData[weekStart].Revenue += d.Revenue;
            weeklyData[weekStart].Transactions += d.Transactions;
            weeklyData[weekStart]['Link Clicks'] += d['Link Clicks'];
            weeklyData[weekStart].Impressions += d.Impressions;
            weeklyData[weekStart].days++;
        });
    
        return Object.values(weeklyData)
            .filter(w => w.days > 3) // Only include weeks with at least 4 days of data
            .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
            .map(w => ({
                ...w,
                ROAS: w.Spend > 0 ? w.Revenue / w.Spend : 0,
                CPA: w.Transactions > 0 ? w.Spend / w.Transactions : 0,
                AOV: w.Transactions > 0 ? w.Revenue / w.Transactions : 0,
                'CTR (%)': w.Impressions > 0 ? (w['Link Clicks'] / w.Impressions) * 100 : 0
            }));
    }

    function renderPitchDashboard() {
        PITCH_DOM.uploadContainer.classList.add('hidden');
        PITCH_DOM.mainContent.classList.remove('hidden');

        renderPeriodOverPeriod();
        renderKeyMetrics();
        renderDayOfWeekAnalysis();
        renderTakeaways();
        renderCharts();
    }
    
    function renderPeriodOverPeriod() {
        const periodDays = parseInt(PITCH_DOM.popSelect.value, 10);
        if (processedPitchData.length < periodDays * 2) {
            PITCH_DOM.popMetricsContainer.innerHTML = `<p class="col-span-4 text-center text-gray-500">Not enough data for a ${periodDays}-day comparison.</p>`;
            return;
        }

        const currentPeriodData = processedPitchData.slice(-periodDays);
        const previousPeriodData = processedPitchData.slice(-periodDays * 2, -periodDays);

        const calculateMetrics = (data) => {
            const spend = data.reduce((sum, d) => sum + d.Spend, 0);
            const revenue = data.reduce((sum, d) => sum + d.Revenue, 0);
            const transactions = data.reduce((sum, d) => sum + d.Transactions, 0);
            return {
                Spend: spend,
                Revenue: revenue,
                ROAS: spend > 0 ? revenue / spend : 0,
                CPA: transactions > 0 ? spend / transactions : 0,
            };
        };

        const currentMetrics = calculateMetrics(currentPeriodData);
        const previousMetrics = calculateMetrics(previousPeriodData);
        
        const metricsToDisplay = ['Spend', 'Revenue', 'ROAS', 'CPA'];
        
        PITCH_DOM.popMetricsContainer.innerHTML = metricsToDisplay.map(metric => {
            const current = currentMetrics[metric];
            const previous = previousMetrics[metric];
            const delta = ((current - previous) / previous) * 100;
            const isNegativeGood = ['CPA'].includes(metric);
            
            let colorClass = '';
            if (isFinite(delta)) {
                if (delta > 0) colorClass = isNegativeGood ? 'delta-negative' : 'delta-positive';
                if (delta < 0) colorClass = isNegativeGood ? 'delta-positive' : 'delta-negative';
            }

            const formatValue = (val) => {
                if (['Spend', 'Revenue', 'CPA'].includes(metric)) return `DKK ${val.toLocaleString('da-DK', {maximumFractionDigits: 2})}`;
                return val.toFixed(2);
            };

            return `
                <div class="pop-metric-card">
                    <p class="text-sm text-gray-600">${metric}</p>
                    <p class="text-2xl font-bold text-gray-900 mt-1">${formatValue(current)}</p>
                    <div class="flex items-center justify-center mt-2 text-xs">
                        <span class="pop-delta ${colorClass}">${isFinite(delta) ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : 'N/A'}</span>
                        <span class="ml-2 text-gray-500">vs ${formatValue(previous)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderKeyMetrics() {
        const totalSpend = processedPitchData.reduce((sum, day) => sum + day.Spend, 0);
        const totalRevenue = processedPitchData.reduce((sum, day) => sum + day.Revenue, 0);
        const totalTransactions = processedPitchData.reduce((sum, day) => sum + day.Transactions, 0);

        const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        const avgCpa = totalTransactions > 0 ? totalSpend / totalTransactions : 0;

        const metrics = [
            { label: 'Total Spend', value: `DKK ${totalSpend.toLocaleString('da-DK', {maximumFractionDigits: 0})}` },
            { label: 'Total Revenue', value: `DKK ${totalRevenue.toLocaleString('da-DK', {maximumFractionDigits: 0})}` },
            { label: 'Overall ROAS', value: overallRoas.toFixed(2) },
            { label: 'Average CPA', value: `DKK ${avgCpa.toLocaleString('da-DK', {maximumFractionDigits: 2})}` }
        ];

        PITCH_DOM.keyMetricsContainer.innerHTML = metrics.map(m => `
            <div class="summary-card text-center">
                <p class="text-sm text-gray-600">${m.label}</p>
                <p class="text-3xl font-bold text-gray-900 mt-1">${m.value}</p>
            </div>
        `).join('');
    }

    function renderTakeaways() {
        generatedTakeaways = generateAllTakeaways(); // Use the new comprehensive function
        const iconMap = {
            Opportunity: `<svg class="h-6 w-6 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>`,
            Risk: `<svg class="h-6 w-6 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>`,
            Insight: `<svg class="h-6 w-6 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
        };

        PITCH_DOM.takeawaysList.innerHTML = generatedTakeaways.map((item, index) => `
            <li class="glass-container flex flex-col gap-3 p-4 rounded-lg">
                <div class="flex items-start gap-4">
                    <div class="flex-shrink-0">${iconMap[item.type]}</div>
                    <div class="flex-grow">
                        <span class="takeaway-badge takeaway-badge-${item.type}">${item.type}</span>
                        <p class="text-gray-800 dark:text-gray-300 inline">${item.summary}</p>
                    </div>
                </div>
                ${item.chartType ? `<button data-takeaway-index="${index}" class="view-takeaway-details-btn self-start text-sm font-semibold text-[#5248e2] dark:text-[#818cf8] px-3 py-1 rounded-full transition-colors">View Details</button>` : ''}
            </li>
        `).join('');
    }
    
    function renderDayOfWeekAnalysis() {
        if (pitchCharts.dow) pitchCharts.dow.destroy();
        
        const metric = PITCH_DOM.dowSelect.value;
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayData = Array(7).fill(0).map(() => ({ total: 0, count: 0 }));

        processedPitchData.forEach(d => {
            const dayOfWeek = new Date(d.Day).getUTCDay();
            dayData[dayOfWeek].total += d[metric] || 0;
            dayData[dayOfWeek].count++;
        });

        const averages = dayData.map(d => d.count > 0 ? d.total / d.count : 0);
        const themeColors = getThemeColors();
        
        pitchCharts.dow = new Chart(PITCH_DOM.dowChart, {
            type: 'bar',
            data: {
                labels: days,
                datasets: [{
                    label: `Average ${metric}`,
                    data: averages,
                    backgroundColor: themeColors.primaryRgba_Bar,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: themeColors.ticks }, grid: { display: false } },
                    y: { ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }
                }
            }
        });
    }


    function renderCharts() {
        Object.values(pitchCharts).forEach(chart => {
            if(chart && chart.canvas.id !== 'pitch-dow-chart') chart.destroy();
        });
        const themeColors = getThemeColors();
        const labels = processedPitchData.map(d => d.Day);

        // Performance Chart
        pitchCharts.performance = new Chart(PITCH_DOM.performanceChart, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Spend', data: processedPitchData.map(d => d.Spend), yAxisID: 'y', backgroundColor: themeColors.secondaryRgba, borderColor: themeColors.secondary },
                    { label: 'Revenue', data: processedPitchData.map(d => d.Revenue), yAxisID: 'y1', type: 'line', borderColor: themeColors.primary, tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Performance Over Time', color: themeColors.title, font:{size:16} }, legend: {labels:{color:themeColors.legend}} }, scales: { x: { ticks:{color:themeColors.ticks}, grid:{color:themeColors.grid} }, y: { position:'left', title:{display:true, text:'Spend (DKK)', color:themeColors.ticks}, ticks:{color:themeColors.ticks}, grid:{color:themeColors.grid} }, y1: { position:'right', title:{display:true, text:'Revenue (DKK)', color:themeColors.ticks}, ticks:{color:themeColors.ticks}, grid:{display:false} } } }
        });

        // Efficiency Chart
        pitchCharts.efficiency = new Chart(PITCH_DOM.efficiencyChart, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'ROAS', data: processedPitchData.map(d => d.ROAS), yAxisID: 'y', borderColor: themeColors.primary, tension: 0.4 },
                    { label: 'CPA', data: processedPitchData.map(d => d.CPA), yAxisID: 'y1', borderColor: themeColors.danger, tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Efficiency Over Time', color: themeColors.title, font:{size:16} }, legend: {labels:{color:themeColors.legend}} }, scales: { x: { ticks:{color:themeColors.ticks}, grid:{color:themeColors.grid} }, y: { position:'left', title:{display:true, text:'ROAS', color:themeColors.ticks}, ticks:{color:themeColors.ticks}, grid:{color:themeColors.grid}, beginAtZero: true }, y1: { position:'right', title:{display:true, text:'CPA (DKK)', color:themeColors.ticks}, ticks:{color:themeColors.ticks}, grid:{display:false}, beginAtZero: true } } }
        });
        
        // Scatter Chart
        const spendData = processedPitchData.map(d => d.Spend);
        const revenueData = processedPitchData.map(d => d.Revenue);
        const { slope, intercept } = linearRegression(spendData, revenueData);
        pitchCharts.scatter = new Chart(PITCH_DOM.scatterChart, {
            type: 'scatter',
            data: { datasets: [{ label: 'Daily Data', data: processedPitchData.map(d => ({x: d.Spend, y: d.Revenue})), backgroundColor: themeColors.primaryRgba_Scatter }, { label: 'Trendline', data: [{x: Math.min(...spendData), y: slope * Math.min(...spendData) + intercept}, {x: Math.max(...spendData), y: slope * Math.max(...spendData) + intercept}], type: 'line', borderColor: themeColors.primary, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Daily Spend vs Revenue', color: themeColors.title, font:{size:16} }, legend: {display:false} }, scales: { x: { title:{display:true, text:'Spend (DKK)', color:themeColors.ticks}, ticks:{color:themeColors.ticks}, grid:{color:themeColors.grid} }, y: { title:{display:true, text:'Revenue (DKK)', color:themeColors.ticks}, ticks:{color:themeColors.ticks}, grid:{color:themeColors.grid} } } }
        });

        // Weekly Spend Chart
        const weeklySpend = {};
        processedPitchData.forEach(d => {
            const date = new Date(d.Day);
            const dayOfWeek = date.getUTCDay();
            const dateOnly = new Date(date.setUTCHours(0,0,0,0)); // Normalize to start of day UTC
            dateOnly.setUTCDate(dateOnly.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Set to Monday
            const weekStart = dateOnly.toISOString().split('T')[0];

            if (!weeklySpend[weekStart]) weeklySpend[weekStart] = 0;
            weeklySpend[weekStart] += d.Spend;
        });
        const weeklyLabels = Object.keys(weeklySpend).sort();
        pitchCharts.weekly = new Chart(PITCH_DOM.weeklySpendChart, {
            type: 'bar',
            data: { labels: weeklyLabels.map(l => `Wk of ${l}`), datasets: [{ label: 'Weekly Spend', data: weeklyLabels.map(l => weeklySpend[l]), backgroundColor: themeColors.primaryRgba_Bar }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Weekly Spend Distribution', color: themeColors.title, font:{size:16} }, legend: {display:false} }, scales: { x: { ticks:{color:themeColors.ticks}, grid:{display:false} }, y: { title:{display:true, text:'Spend (DKK)', color:themeColors.ticks}, ticks:{color:themeColors.ticks}, grid:{color:themeColors.grid} } } }
        });
    }

    function showTakeawayDetailsModal(takeaway) {
        if (!takeaway) return;
        
        PITCH_DOM.takeawayDetails.title.textContent = takeaway.title;
        PITCH_DOM.takeawayDetails.description.innerHTML = takeaway.details;

        renderTakeawayDetailsChart(takeaway.chartType, takeaway.chartData);

        PITCH_DOM.takeawayDetails.modal.classList.replace('hidden', 'flex');
        setTimeout(() => {
            PITCH_DOM.takeawayDetails.backdrop.classList.add('open');
            PITCH_DOM.takeawayDetails.content.classList.add('open');
        }, 10);
    }

    function hideTakeawayDetailsModal() {
        if (takeawayDetailsChart) {
            takeawayDetailsChart.destroy();
            takeawayDetailsChart = null;
        }
        PITCH_DOM.takeawayDetails.backdrop.classList.remove('open');
        PITCH_DOM.takeawayDetails.content.classList.remove('open');
        setTimeout(() => PITCH_DOM.takeawayDetails.modal.classList.replace('flex', 'hidden'), 300);
    }

    function renderTakeawayDetailsChart(type, data) {
        if (takeawayDetailsChart) takeawayDetailsChart.destroy();
        if (!type || !data) {
            PITCH_DOM.takeawayDetails.chartCanvas.style.display = 'none';
            return;
        }
    
        PITCH_DOM.takeawayDetails.chartCanvas.style.display = 'block';
        const themeColors = getThemeColors();
        const ctx = PITCH_DOM.takeawayDetails.chartCanvas.getContext('2d');
        let config = {};
    
        switch (type) {
            case 'scatter':
                const scatterDatasets = [{
                    label: 'Daily Data',
                    data: data.points,
                    backgroundColor: themeColors.primaryRgba_Scatter
                }];
                if (data.trendline) {
                    const x = data.points.map(p => p.x);
                    const y = data.points.map(p => p.y);
                    const { slope, intercept } = linearRegression(x, y);
                    scatterDatasets.push({
                        label: 'Trendline',
                        data: [{ x: Math.min(...x), y: slope * Math.min(...x) + intercept }, { x: Math.max(...x), y: slope * Math.max(...x) + intercept }],
                        type: 'line',
                        borderColor: themeColors.primary,
                        pointRadius: 0
                    });
                }
                config = {
                    type: 'scatter',
                    data: { datasets: scatterDatasets },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: data.xLabel || 'X-Axis' }, ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }, y: { title: { display: true, text: data.yLabel || 'Y-Axis' }, ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } } } }
                };
                break;
    
            case 'combo':
            case 'line':
            case 'bar':
                const color_map = [themeColors.primary, themeColors.secondary, themeColors.danger, themeColors.accent];
                const color_map_rgba_bar = [themeColors.primaryRgba_Bar, themeColors.secondaryRgba, themeColors.dangerRgba_Bar, themeColors.accentRgba];
                const color_map_rgba = [themeColors.primaryRgba, themeColors.secondaryRgba, themeColors.dangerRgba, themeColors.accentRgba];
    
                const chartDatasets = data.datasets.map((ds, index) => {
                    const chartType = ds.type || type;
                    return {
                        ...ds,
                        borderColor: ds.borderColor || color_map[index % color_map.length],
                        backgroundColor: ds.backgroundColor || (chartType === 'bar' ? color_map_rgba_bar[index % color_map_rgba_bar.length] : color_map_rgba[index % color_map_rgba.length]),
                        tension: 0.4,
                        fill: chartType === 'line',
                    };
                });
    
                config = {
                    type: type === 'combo' ? 'bar' : type,
                    data: {
                        labels: data.labels,
                        datasets: chartDatasets,
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: data.datasets.length > 1, labels: { color: themeColors.legend } } },
                        scales: {
                            x: { ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } },
                            y: { type: 'linear', display: true, position: 'left', ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid }, title: { display: !!data.yLabel, text: data.yLabel || '', color: themeColors.ticks } },
                            ...(data.y1Label && { y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: themeColors.ticks }, title: { display: true, text: data.y1Label, color: themeColors.ticks } } })
                        }
                    }
                };
                break;
    
            case 'pie':
                config = {
                    type: 'pie',
                    data: {
                        labels: data.labels,
                        datasets: [{ data: data.data, backgroundColor: [themeColors.primary, themeColors.secondary, themeColors.accent, themeColors.danger] }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: themeColors.legend } } } }
                };
                break;
        }
    
        takeawayDetailsChart = new Chart(ctx, config);
    }

    
    function generateAllTakeaways() {
        const takeaways = [];
        const n = processedPitchData.length;
        if (n === 0) return takeaways;

        // --- Weekly Aggregates ---
        const weeklyAggregates = getWeeklyAggregates(processedPitchData);
    
        if (n < 7) {
            takeaways.push({ title: "Short Data Period", summary: "Data covers a short period, so trend analysis may be limited.", details: "With less than a week of data, identifying long-term trends is difficult.", type: "Insight", chartType: null });
        }
    
        // --- Day of Week Analysis ---
        const dayOfWeekData = Array(7).fill(0).map(() => ({ roasSum: 0, count: 0 }));
        processedPitchData.forEach(d => {
            const dayIndex = new Date(d.Day).getUTCDay();
            dayOfWeekData[dayIndex].roasSum += d.ROAS;
            dayOfWeekData[dayIndex].count++;
        });
        const dayOfWeekAvgs = dayOfWeekData.map(d => ({ avgRoas: d.count > 0 ? d.roasSum / d.count : 0 }));
        const bestRoasDayIndex = dayOfWeekAvgs.reduce((iMax, x, i, arr) => x.avgRoas > arr[iMax].avgRoas ? i : iMax, 0);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (dayOfWeekAvgs[bestRoasDayIndex].avgRoas > 0) {
            takeaways.push({ title: "Day of Week Opportunity", summary: `<strong>${days[bestRoasDayIndex]}s</strong> show the highest average ROAS, presenting a potential opportunity for budget scaling on that day.`, details: "Analyzing performance by day of the week reveals patterns in user behavior. A consistently higher ROAS on certain days suggests that's when your audience is most likely to convert. Shifting more budget to these high-performing days could improve overall efficiency.", type: "Opportunity", chartType: 'bar', chartData: { labels: days, datasets: [{ label: 'Average ROAS', data: dayOfWeekAvgs.map(d => d.avgRoas) }] } });
        }

        // --- Trend Analyses (only if enough weekly data) ---
        if (weeklyAggregates.length >= 4) {
            const weekNumbers = Array.from({ length: weeklyAggregates.length }, (_, i) => i);
            const weeklyCpas = weeklyAggregates.map(w => w.CPA).filter(cpa => isFinite(cpa) && cpa > 0);
            const weeklyRoas = weeklyAggregates.map(w => w.ROAS);

            // CPA Trend Risk
            if (weeklyCpas.length >= 4) {
                const { slope: cpaSlope } = linearRegression(weekNumbers.slice(0, weeklyCpas.length), weeklyCpas);
                const changePercent = ((weeklyCpas[weeklyCpas.length - 1] - weeklyCpas[0]) / weeklyCpas[0]) * 100;
                if (cpaSlope > 0 && changePercent > 10) {
                    takeaways.push({ title: "Increasing CPA Trend", summary: `The average Cost Per Acquisition (CPA) has been trending <strong>upwards by ${changePercent.toFixed(0)}%</strong> over the analyzed period, indicating a potential decline in efficiency.`, details: "An increasing CPA means it's costing more to acquire each customer. This can be caused by ad fatigue, audience saturation, or increased competition. It's crucial to investigate the campaigns and ad sets driving this increase to maintain profitability.", type: "Risk", chartType: 'line', chartData: { labels: weeklyAggregates.map(w => `Wk of ${w.weekStart}`), datasets: [{ label: 'Weekly CPA', data: weeklyAggregates.map(w => w.CPA) }] } });
                }
            }

            // ROAS Trend Risk
            const { slope: roasSlope } = linearRegression(weekNumbers, weeklyRoas);
            const roasChangePercent = ((weeklyRoas[weeklyRoas.length - 1] - weeklyRoas[0]) / weeklyRoas[0]) * 100;
            if (roasSlope < 0 && roasChangePercent < -10) {
                takeaways.push({ title: "Decreasing ROAS Trend", summary: `The Return On Ad Spend (ROAS) has been trending <strong>downwards by ${Math.abs(roasChangePercent).toFixed(0)}%</strong>, posing a risk to overall profitability.`, details: "A decreasing ROAS indicates that the revenue generated per dollar of ad spend is declining. This could be due to rising ad costs (CPM), lower conversion rates, or a drop in average order value. Analyzing these underlying metrics is key to reversing the trend.", type: "Risk", chartType: 'line', chartData: { labels: weeklyAggregates.map(w => `Wk of ${w.weekStart}`), datasets: [{ label: 'Weekly ROAS', data: weeklyAggregates.map(w => w.ROAS) }] } });
            }

            // Diminishing Returns Insight
            const weeklySpend = weeklyAggregates.map(w => w.Spend);
            const spendRoasCorr = correl(weeklySpend, weeklyRoas);
            if (spendRoasCorr < -0.3) {
                takeaways.push({ title: "Potential Diminishing Returns", summary: `There is a <strong>negative correlation (${spendRoasCorr.toFixed(2)})</strong> between weekly spend and ROAS, suggesting that as budgets increase, efficiency may decrease.`, details: "This pattern is common and known as diminishing returns. It means that each additional dollar spent generates less revenue than the one before it. While scaling, it's important to monitor ROAS closely and find the 'sweet spot' for budget allocation before efficiency drops too much.", type: "Insight", chartType: 'scatter', chartData: { points: weeklyAggregates.map(w => ({ x: w.Spend, y: w.ROAS })), trendline: true, xLabel: 'Weekly Spend (DKK)', yLabel: 'Weekly ROAS' } });
            }

             // High-Value Engagement Opportunity
            const avgAOV = processedPitchData.reduce((sum, d) => sum + d.AOV, 0) / n;
            const avgCTR = processedPitchData.reduce((sum, d) => sum + d['CTR (%)'], 0) / n;
            const highValueWeeks = weeklyAggregates.filter(w => w.AOV > avgAOV * 1.1 && w['CTR (%)'] > avgCTR * 1.1);
            if (highValueWeeks.length > 0) {
                const bestWeek = highValueWeeks.sort((a,b) => b.Revenue - a.Revenue)[0];
                const themeColors = getThemeColors();
                 takeaways.push({
                    title: "High-Value Engagement",
                    summary: `Some weeks, like the week of <strong>${bestWeek.weekStart}</strong>, showed both high ad engagement (CTR) and high customer value (AOV).`,
                    details: "This indicates that certain ads or targeting strategies are successfully attracting customers who are not only interested but also willing to spend more. Analyzing the campaigns, creatives, and audiences from this period could uncover valuable insights for future campaigns.",
                    type: "Opportunity",
                    chartType: 'combo',
                    chartData: {
                        labels: weeklyAggregates.map(w => `Wk of ${w.weekStart}`),
                        yLabel: 'AOV (DKK)',
                        y1Label: 'CTR (%)',
                        datasets: [
                            { label: 'Weekly AOV', data: weeklyAggregates.map(w => w.AOV), yAxisID: 'y', type: 'bar' },
                            { label: 'Weekly CTR (%)', data: weeklyAggregates.map(w => w['CTR (%)']), yAxisID: 'y1', type: 'line', borderColor: themeColors.secondary, backgroundColor: themeColors.secondaryRgba }
                        ]
                    }
                });
            }
        }
    
        // Spend vs Revenue Correlation
        const spendData = processedPitchData.map(d => d.Spend);
        const revenueData = processedPitchData.map(d => d.Revenue);
        const spendRevenueCorr = correl(spendData, revenueData);
        if (spendRevenueCorr > 0.4) {
            takeaways.push({ title: "Spend & Revenue Correlation", summary: `A <strong>positive correlation (${spendRevenueCorr.toFixed(2)})</strong> exists between daily spend and revenue, suggesting good scalability.`, details: "A positive correlation indicates that as ad spend increases, revenue tends to increase as well. This is a healthy sign for scaling campaigns. The chart visualizes this relationship, with each point representing a day's spend and revenue.", chartType: 'scatter', chartData: { points: processedPitchData.map(d => ({ x: d.Spend, y: d.Revenue })), trendline: true, xLabel: 'Spend (DKK)', yLabel: 'Revenue (DKK)' }, type: "Insight" });
        } else if (spendRevenueCorr < 0) {
            takeaways.push({ title: "Spend & Revenue Correlation", summary: `A <strong>negative correlation (${spendRevenueCorr.toFixed(2)})</strong> between spend and revenue indicates potential efficiency issues at higher spend levels.`, details: "A negative correlation is unusual and suggests that increasing spend may be leading to lower revenue, indicating severe diminishing returns or targeting issues. This requires immediate investigation.", chartType: 'scatter', chartData: { points: processedPitchData.map(d => ({ x: d.Spend, y: d.Revenue })), trendline: true, xLabel: 'Spend (DKK)', yLabel: 'Revenue (DKK)' }, type: "Risk" });
        }

        return takeaways;
    }


    function setupEventListeners() {
        document.addEventListener('pitchDataProcessed', renderPitchDashboard);
        
        PITCH_DOM.dropZone.addEventListener('click', () => PITCH_DOM.fileInput.click());
        PITCH_DOM.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handlePitchFile(e.target.files[0]);
            e.target.value = '';
        });
        PITCH_DOM.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); PITCH_DOM.dropZone.classList.add('dragover'); });
        PITCH_DOM.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); PITCH_DOM.dropZone.classList.remove('dragover'); });
        PITCH_DOM.dropZone.addEventListener('drop', handleFileDrop);
        
        PITCH_DOM.exportBtn.addEventListener('click', () => window.print());
        PITCH_DOM.popSelect.addEventListener('change', renderPeriodOverPeriod);
        PITCH_DOM.dowSelect.addEventListener('change', renderDayOfWeekAnalysis);

        PITCH_DOM.darkModeCheckbox.addEventListener('change', () => {
            if (!PITCH_DOM.view.classList.contains('is-inactive') && processedPitchData.length > 0) {
                setTimeout(() => {
                    renderCharts();
                    renderDayOfWeekAnalysis();
                    if(takeawayDetailsChart) {
                        const activeTakeaway = generatedTakeaways.find(t => t.title === PITCH_DOM.takeawayDetails.title.textContent);
                        if(activeTakeaway) renderTakeawayDetailsChart(activeTakeaway.chartType, activeTakeaway.chartData);
                    }
                }, 50);
            }
        });

        PITCH_DOM.takeawaysList.addEventListener('click', (e) => {
            const button = e.target.closest('.view-takeaway-details-btn');
            if (button) {
                const index = parseInt(button.dataset.takeawayIndex, 10);
                if (!isNaN(index) && generatedTakeaways[index]) {
                    showTakeawayDetailsModal(generatedTakeaways[index]);
                }
            }
        });
    
        PITCH_DOM.takeawayDetails.closeBtn.addEventListener('click', hideTakeawayDetailsModal);
        PITCH_DOM.takeawayDetails.backdrop.addEventListener('click', hideTakeawayDetailsModal);
    }

    setupEventListeners();
});