// --- Ad Spend Analyzer Logic ---
function resetAnalyzerView() {
    DOM.analyzer.dropZone.classList.remove('upload-success');
    DOM.analyzer.dropZone.innerHTML = `
        <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4 4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <p class="mt-4 text-sm text-gray-600"><span class="font-semibold text-[#5248e2]">Upload a file</span> or drag and drop</p>
        <p class="text-xs text-gray-500">CSV files exported from Meta Ads</p>
    `;
    DOM.analyzer.summaryContainer.classList.add('hidden');
    DOM.analyzer.controlsContainer.classList.add('hidden');
    DOM.analyzer.resultsContainer.classList.add('hidden');
    DOM.analyzerDashboard.content.classList.add('hidden');


    document.querySelectorAll('.data-dependent').forEach(button => {
        button.disabled = true;
        const statusText = button.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = 'Upload data to proceed';
            statusText.classList.remove('text-purple-ready');
            statusText.classList.add('text-red-500');
        }
    });
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    DOM.analyzer.dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleAnalyzerFileContent(csvText, filename) {
    try {
        parseAndStoreCsv(csvText);
        if (analyzerData.length > 0) {
            addToFileLibrary({ name: filename, content: csvText, context: 'Performance Analyzer' });
            processAndRenderAnalyzerData();
            DOM.analyzer.dropZone.classList.add('upload-success');
            DOM.analyzer.dropZone.innerHTML = `
                <div class="success-animation-container">
                    <svg class="success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle class="success-checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                        <path class="success-checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                    <p class="text-lg font-semibold text-gray-800 mt-2">Upload Successful</p>
                    <p class="text-sm text-gray-600">${analyzerData.length} rows processed.</p>
                </div>
            `;

            document.querySelectorAll('.data-dependent').forEach(button => {
                button.disabled = false;
                const statusText = button.querySelector('.status-text');
                if (statusText) {
                    statusText.textContent = 'Ready to use';
                    statusText.classList.remove('text-red-500');
                    statusText.classList.add('text-purple-ready');
                }
            });
        } else {
           throw new Error('CSV file is empty or invalid.');
        }
    } catch (error) {
        showNotification(error.message, 'error');
        resetAnalyzerView();
    }
}

function handleFile(file) {
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
        const reader = new FileReader();
        reader.onload = (e) => {
            handleAnalyzerFileContent(e.target.result, file.name);
        };
        reader.readAsText(file);
    } else {
        showNotification('Please upload a valid .csv file.', 'error');
    }
}

function parseAndStoreCsv(csvText) {
    const rows = csvText.split('\n').filter(row => row.trim() !== '');
    if (rows.length < 2) {
        analyzerData = [];
        throw new Error("CSV file has no data rows.");
    }

    const header = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const metricAliases = {
        'Day': ['Day', 'Date', 'Reporting starts'],
        'Spend': ['Amount spent (DKK)', 'Spend', 'Cost', 'Amount Spent'],
        'Revenue': ['Website purchase conversion value', 'Purchase conversion value', 'Purchases conversion value', 'Conv. value', 'Total conversion value'],
        'Transactions': ['Purchases', 'Conversions', 'Website purchases'],
        'Link Clicks': ['Link clicks', 'Clicks'],
        'Impressions': ['Impressions', 'Impr.'],
        'Reach': ['Reach'],
        'CPC': ['CPC (cost per link click)', 'Avg. CPC', 'CPC'],
        'CTR (%)': ['CTR (link click-through rate)', 'CTR', 'CTR (all)'],
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
        } else {
            const firstDataRowValues = rows[1].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (firstDataRowValues[index] && !isNaN(parseFloat(firstDataRowValues[index].trim().replace(/"/g, '').replace(/[^0-9.-]/g, '')))) {
                headerMapping[index] = col;
            }
        }
    });

    if (dayIndex === -1) {
        throw new Error("CSV must contain a 'Day' or 'Date' column.");
    }
    
    analyzerData = rows.slice(1).map(row => {
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
}

function processAndRenderAnalyzerData() {
    if (analyzerData.length === 0) return;
    
    let totalSpend = 0;
    let totalRevenue = 0;
    let totalTransactions = 0;

    processedAnalyzerData = analyzerData.map(d => {
        const processedRow = { ...d };
        delete processedRow.Day;

        const spend = d['Spend'] || 0;
        const revenue = d['Revenue'] || 0;
        const transactions = d['Transactions'] || 0;
        const linkClicks = d['Link Clicks'] || 0;
        const impressions = d['Impressions'] || 0;
        const reach = d['Reach'] || 0;

        totalSpend += spend;
        totalRevenue += revenue;
        totalTransactions += transactions;

        processedRow['AOV'] = transactions > 0 ? revenue / transactions : 0;
        processedRow['ROAS'] = spend > 0 ? revenue / spend : 0;
        processedRow['CPM'] = impressions > 0 ? (spend / impressions) * 1000 : 0;
        processedRow['CPA'] = transactions > 0 ? spend / transactions : 0;
        processedRow['Frequency'] = reach > 0 ? impressions / reach : 0;
        
        if (!('CPC' in processedRow)) {
            processedRow['CPC'] = linkClicks > 0 ? spend / linkClicks : 0;
        }
        if (!('CTR (%)' in processedRow)) {
             processedRow['CTR (%)'] = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
        }

        return processedRow;
    });

    const weightedAOV = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const weightedROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    DOM.analyzer.summaryContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="summary-card"><p class="text-sm text-gray-600">Amount Spent</p><p class="text-2xl font-bold text-gray-900">DKK ${totalSpend.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div class="summary-card"><p class="text-sm text-gray-600">Revenue</p><p class="text-2xl font-bold text-gray-900">DKK ${totalRevenue.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div class="summary-card"><p class="text-sm text-gray-600">Weighted AOV</p><p class="text-2xl font-bold text-gray-900">DKK ${weightedAOV.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div class="summary-card"><p class="text-sm text-gray-600">Weighted ROAS</p><p class="text-2xl font-bold text-gray-900">${weightedROAS.toFixed(2)}</p></div>
        </div>
    `;
    DOM.analyzer.summaryContainer.classList.remove('hidden');
    DOM.analyzerDashboard.content.classList.remove('hidden');

    populateTop5Metrics();
    renderAnalyzerDashboard();
}

function populateTop5Metrics() {
    if (processedAnalyzerData.length === 0) return;
    const metrics = Object.keys(processedAnalyzerData[0]);
    const select = DOM.analyzerDashboard.top5MetricSelect;
    
    const currentValue = select.value;
    select.innerHTML = '';
    metrics.forEach(metric => {
        const option = document.createElement('option');
        option.value = metric;
        option.textContent = metric;
        select.appendChild(option);
    });

    if (metrics.includes(currentValue)) {
        select.value = currentValue;
    } else if (metrics.includes('ROAS')) {
        select.value = 'ROAS';
    }
}

function renderAnalyzerDashboard() {
    const { aggregatedData, labels } = aggregateData(analyzerDashboardTimeAggregation);
    renderAnalyzerDashboardCharts(aggregatedData, labels);
    renderAnalyzerTop5Table(aggregatedData, labels);
}

function renderAnalyzerDashboardCharts(aggregatedData, labels) {
    Object.values(analyzerDashboardCharts).forEach(chart => chart.destroy());
    const themeColors = getThemeColors();

    // Scatter Plot
    const scatterData = aggregatedData.map(d => ({ x: d.Spend, y: d.Revenue }));
    analyzerDashboardCharts.scatter = new Chart(DOM.analyzerDashboard.scatterCanvas, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Spend vs Revenue',
                data: scatterData,
                backgroundColor: themeColors.primaryRgba_Scatter
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: `${analyzerDashboardTimeAggregation} Spend vs. Revenue`, color: themeColors.title, font: {size: 16} } },
            scales: {
                x: { title: { display: true, text: 'Spend (DKK)', color: themeColors.ticks }, grid: { color: themeColors.grid }, ticks: { color: themeColors.ticks } },
                y: { title: { display: true, text: 'Revenue (DKK)', color: themeColors.ticks }, grid: { color: themeColors.grid }, ticks: { color: themeColors.ticks } }
            }
        }
    });

    // Bar Chart
    const spendData = aggregatedData.map(d => d.Spend);
    analyzerDashboardCharts.bar = new Chart(DOM.analyzerDashboard.spendCanvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Spend',
                data: spendData,
                backgroundColor: themeColors.primaryRgba_Bar,
                borderColor: themeColors.primary,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: `${analyzerDashboardTimeAggregation} Spend`, color: themeColors.title, font: {size: 16} } },
            scales: {
                x: { grid: { display: false }, ticks: { color: themeColors.ticks } },
                y: { title: { display: true, text: 'Spend (DKK)', color: themeColors.ticks }, grid: { color: themeColors.grid }, ticks: { color: themeColors.ticks } }
            }
        }
    });
}

function renderAnalyzerTop5Table() {
    const { aggregatedData, labels } = aggregateData(analyzerDashboardTimeAggregation);
    const metric = DOM.analyzerDashboard.top5MetricSelect.value;
    const isAscending = ['CPA', 'CPC', 'CPM'].includes(metric);

    const combinedAndLabeledData = aggregatedData.map((row, index) => ({
        ...row,
        periodLabel: labels[index]
    }));
    
    const sortedData = [...combinedAndLabeledData].sort((a, b) => {
        return isAscending ? a[metric] - b[metric] : b[metric] - a[metric];
    });

    const bestPeriods = sortedData.slice(0, 5);
    const allHeaders = ['Spend', 'Revenue', 'Transactions', 'AOV', 'ROAS', 'CPA'];
    
    const title = `Top 5 ${analyzerDashboardTimeAggregation} Periods by ${metric}`;
    let tableHTML = `
        <div class="overflow-x-auto">
            <table class="analyzer-table text-sm">
                <thead>
                    <tr>
                        <th class="capitalize">${analyzerDashboardTimeAggregation.slice(0,-2)}</th>
                        ${allHeaders.map(h => `<th class="${h === metric ? 'bg-[#c8d2fe]' : ''}">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    bestPeriods.forEach(period => {
        tableHTML += `<tr>`;
        tableHTML += `<td class="font-semibold">${period.periodLabel}</td>`;
        allHeaders.forEach(header => {
            const value = period[header];
            const formattedValue = typeof value === 'number' ? value.toLocaleString('da-DK', { maximumFractionDigits: 2}) : value;
            tableHTML += `<td class="${header === metric ? 'bg-[#c8d2fe] font-bold' : ''}">${formattedValue}</td>`;
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table></div>`;

    DOM.analyzerDashboard.top5TableWrapper.innerHTML = tableHTML;
    // Ensure title element exists before setting textContent
    const titleElement = DOM.analyzerDashboard.top5Container.querySelector('h3');
    if (titleElement) {
        titleElement.textContent = title;
    } else {
         const newTitle = document.createElement('h3');
         newTitle.className = "text-lg font-semibold text-gray-900 mb-4";
         newTitle.textContent = title;
         DOM.analyzerDashboard.top5Container.insertBefore(newTitle, DOM.analyzerDashboard.top5Container.firstChild);
    }
}

function renderAnalyzerTable() {
    const tableHeaders = Object.keys(processedAnalyzerData[0]);
    let tableHTML = `<div class="overflow-x-auto glass-container rounded-xl"><table class="analyzer-table"><thead><tr>`;
    tableHeaders.forEach(h => tableHTML += `<th>${h}</th>`);
    tableHTML += `</tr></thead><tbody>`;
    processedAnalyzerData.forEach(row => {
        tableHTML += `<tr>`;
        tableHeaders.forEach(header => tableHTML += `<td>${typeof row[header] === 'number' ? row[header].toFixed(2) : row[header]}</td>`);
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table></div>`;
    DOM.analyzer.resultsContainer.innerHTML = tableHTML;
}

function aggregateData(period) {
    if (analyzerData.length === 0) return { aggregatedData: [], labels: [] };
    
    if (period === 'Daily') {
        return {
            aggregatedData: processedAnalyzerData,
            labels: analyzerData.map(d => formatDate(d.Day))
        };
    }

    const groupedData = {};
    analyzerData.forEach((row, index) => {
        // row.Day is 'YYYY-MM-DD', new Date() parses this as UTC midnight.
        const date = new Date(row.Day);
        let key;
        
        if (period === 'Weekly') {
            const weekStart = new Date(date.getTime());
            const dayOfWeek = weekStart.getUTCDay(); // 0=Sun, 1=Mon, ...
            const diff = weekStart.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
            weekStart.setUTCDate(diff);
            weekStart.setUTCHours(0, 0, 0, 0);
            key = weekStart.toISOString().split('T')[0];
        } else { // Monthly
            key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        }

        if (!groupedData[key]) {
            let label;
            if (period === 'Weekly') {
                label = `Wk of ${formatDate(key)}`;
            } else { // Monthly
                const year = parseInt(key.substring(0, 4));
                const month = parseInt(key.substring(5, 7)) - 1;
                label = new Date(Date.UTC(year, month)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
            }
            groupedData[key] = { 
                ...Object.keys(processedAnalyzerData[0]).reduce((acc, k) => ({...acc, [k]: 0}), {}), 
                count: 0,
                label: label
            };
        }
        
        const group = groupedData[key];
        for(const metric in processedAnalyzerData[index]) {
             group[metric] += processedAnalyzerData[index][metric];
        }
        group.count++;
    });

    const sortedKeys = Object.keys(groupedData).sort();

    const labels = sortedKeys.map(key => groupedData[key].label);
    const aggregatedData = sortedKeys.map(key => {
        const g = groupedData[key];
        const aggregatedRow = {};
        // Recalculate derived metrics for aggregated periods
        aggregatedRow['Spend'] = g.Spend;
        aggregatedRow['Revenue'] = g.Revenue;
        aggregatedRow['Transactions'] = g.Transactions;
        aggregatedRow['Link Clicks'] = g['Link Clicks'];
        aggregatedRow['Impressions'] = g.Impressions;
        aggregatedRow['Reach'] = g.Reach;
        
        aggregatedRow['AOV'] = g.Transactions > 0 ? g.Revenue / g.Transactions : 0;
        aggregatedRow['ROAS'] = g.Spend > 0 ? g.Revenue / g.Spend : 0;
        aggregatedRow['CPM'] = g.Impressions > 0 ? (g.Spend / g.Impressions) * 1000 : 0;
        aggregatedRow['CPA'] = g.Transactions > 0 ? g.Spend / g.Transactions : 0;
        aggregatedRow['CPC'] = g['Link Clicks'] > 0 ? g.Spend / g['Link Clicks'] : 0;
        aggregatedRow['CTR (%)'] = g.Impressions > 0 ? (g['Link Clicks'] / g.Impressions) * 100 : 0;
        aggregatedRow['Frequency'] = g.Reach > 0 ? g.Impressions / g.Reach : 0;

        // Copy over any other metrics that are just summed
        const knownMetrics = ['Spend', 'Revenue', 'Transactions', 'Link Clicks', 'Impressions', 'Reach', 'AOV', 'ROAS', 'CPM', 'CPA', 'CPC', 'CTR (%)', 'Frequency'];
        for(const metric in g) {
            if (!knownMetrics.includes(metric) && metric !== 'count' && metric !== 'label') {
                aggregatedRow[metric] = g[metric];
            }
        }
        
        aggregatedRow.label = g.label;
        return aggregatedRow;
    });

    return { aggregatedData, labels };
}

window.fileHandlers.analyzer = handleAnalyzerFileContent;