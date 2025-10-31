// --- Granulation Modal Logic ---
function showGranulateModal() {
    renderGranulateSelectors();
    renderGranulationTable();
    DOM.granulateModal.modal.classList.replace('hidden', 'flex');
    setTimeout(() => {
        DOM.granulateModal.backdrop.classList.add('open');
        DOM.granulateModal.content.classList.add('open');
    }, 10);
}

function hideGranulateModal() {
    DOM.granulateModal.backdrop.classList.remove('open');
    DOM.granulateModal.content.classList.remove('open');
    setTimeout(() => DOM.granulateModal.modal.classList.replace('flex', 'hidden'), 300);
}

function renderGranulateSelectors() {
    const container = DOM.granulateModal.selectorsContainer;
    container.innerHTML = '';
    if (analyzerData.length === 0) return;

    const allMonths = [...new Set(analyzerData.map(d => d.Day.substring(0, 7)))].sort().reverse();

    if (granulationMode === 'monthOverMonth') {
        const select = document.createElement('select');
        select.id = 'granulate-month-select';
        select.className = 'styled-select rounded-full p-2';
        allMonths.forEach((month, index) => {
            const date = new Date(month + '-02T00:00:00Z');
            const option = document.createElement('option');
            option.value = month;
            option.textContent = date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            if (index === 0) { // Default to most recent month
                option.selected = true;
            }
            select.appendChild(option);
        });
        select.addEventListener('change', renderGranulationTable);
        container.appendChild(select);
    } else { // Custom mode
        const availableYears = [...new Set(analyzerData.map(d => d.Day.substring(0, 4)))].sort().reverse();
        
        const createSelectors = (period) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex items-center gap-2';
            
            const label = document.createElement('span');
            label.className = 'font-medium';
            label.textContent = `Period ${period}:`;
            wrapper.appendChild(label);

            const yearSelect = document.createElement('select');
            yearSelect.id = `granulate-year${period}-select`;
            yearSelect.className = 'styled-select rounded-full p-2';
            availableYears.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            });

            const monthSelect = document.createElement('select');
            monthSelect.id = `granulate-month${period}-select`;
            monthSelect.className = 'styled-select rounded-full p-2';

            yearSelect.addEventListener('change', () => {
                updateMonthOptions(monthSelect.id, yearSelect.value);
                renderGranulationTable();
            });
            monthSelect.addEventListener('change', renderGranulationTable);

            wrapper.appendChild(yearSelect);
            wrapper.appendChild(monthSelect);

            return { wrapper, yearSelect, monthSelect };
        };

        const { wrapper: wrapper1, yearSelect: year1, monthSelect: month1 } = createSelectors('1');
        const { wrapper: wrapper2, yearSelect: year2, monthSelect: month2 } = createSelectors('2');

        container.appendChild(wrapper1);
        const vs = document.createElement('span');
        vs.className = 'mx-2';
        vs.textContent = 'vs';
        container.appendChild(vs);
        container.appendChild(wrapper2);

        // Set defaults
        if (allMonths.length > 0) {
            const [latestYear, latestMonth] = allMonths[0].split('-');
            year1.value = latestYear;
            updateMonthOptions(month1.id, latestYear);
            month1.value = latestMonth;
        }
        if (allMonths.length > 1) {
            const [prevYear, prevMonth] = allMonths[1].split('-');
            year2.value = prevYear;
            updateMonthOptions(month2.id, prevYear);
            month2.value = prevMonth;
        } else if (allMonths.length > 0) { // fallback if only one month of data
            const [latestYear, latestMonth] = allMonths[0].split('-');
            year2.value = latestYear;
            updateMonthOptions(month2.id, latestYear);
            month2.value = latestMonth;
        }
    }
}

function getMonthsForYear(year) {
    const monthsInYear = [...new Set(analyzerData.filter(d => d.Day.startsWith(year)).map(d => d.Day.substring(5, 7)))].sort();
    return monthsInYear.map(m => ({ value: m, text: new Date(year, m - 1).toLocaleString('en-US', { month: 'long' }) }));
}

function updateMonthOptions(selectId, year) {
    const select = document.getElementById(selectId);
    select.innerHTML = '';
    const months = getMonthsForYear(year);
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month.value;
        option.textContent = month.text;
        select.appendChild(option);
    });
}

function getPeriodData(config) {
    let periodData;

    if (config.type === 'month') {
        periodData = config.yearMonth ? analyzerData.filter(d => d.Day.startsWith(config.yearMonth)) : [];
    } else if (config.type === 'range') {
        periodData = (config.startDate && config.endDate) ? analyzerData.filter(d => d.Day >= config.startDate && d.Day <= config.endDate) : [];
    } else {
        periodData = [];
    }
    
    // Base metrics to sum up
    const baseMetrics = ['Spend', 'Revenue', 'Transactions', 'Link Clicks', 'Impressions', 'Reach'];
    const derivedMetrics = ['AOV', 'ROAS', 'CPA', 'CPC', 'CTR (%)', 'Frequency', 'CPM'];
    
    if (periodData.length === 0) {
        const zeroedData = {};
        [...baseMetrics, ...derivedMetrics].forEach(k => zeroedData[k] = 0);
        return zeroedData;
    }

    const totals = periodData.reduce((acc, row) => {
        baseMetrics.forEach(metric => {
            acc[metric] += row[metric] || 0;
        });
        return acc;
    }, { Spend: 0, Revenue: 0, Transactions: 0, 'Link Clicks': 0, Impressions: 0, Reach: 0 });

    // Recalculate all derived metrics from the aggregated totals.
    totals.AOV = totals.Transactions > 0 ? totals.Revenue / totals.Transactions : 0;
    totals.ROAS = totals.Spend > 0 ? totals.Revenue / totals.Spend : 0;
    totals.CPA = totals.Transactions > 0 ? totals.Spend / totals.Transactions : 0;
    totals.CPC = totals['Link Clicks'] > 0 ? totals.Spend / totals['Link Clicks'] : 0;
    totals['CTR (%)'] = totals.Impressions > 0 ? (totals['Link Clicks'] / totals.Impressions) * 100 : 0;
    totals.Frequency = totals.Reach > 0 ? totals.Impressions / totals.Reach : 0;
    totals.CPM = totals.Impressions > 0 ? (totals.Spend / totals.Impressions) * 1000 : 0;
    
    return totals;
}


function renderGranulationTable() {
    let data1, data2;
    let p1Label, p2Label;

    if (granulationMode === 'monthOverMonth') {
        const selectedMonth = document.getElementById('granulate-month-select')?.value;
        if (!selectedMonth) return;
        
        const period1Month = selectedMonth;
        const date = new Date(selectedMonth + '-02T00:00:00Z');
        date.setUTCMonth(date.getUTCMonth() - 1);
        const period2Month = date.toISOString().substring(0, 7);
        
        data1 = getPeriodData({ type: 'month', yearMonth: period1Month });
        data2 = getPeriodData({ type: 'month', yearMonth: period2Month });

        p1Label = new Date(period1Month + '-02T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        p2Label = new Date(period2Month + '-02T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    } else { // Custom mode
        const year1 = document.getElementById('granulate-year1-select')?.value;
        const month1 = document.getElementById('granulate-month1-select')?.value;
        const year2 = document.getElementById('granulate-year2-select')?.value;
        const month2 = document.getElementById('granulate-month2-select')?.value;

        if (!year1 || !month1 || !year2 || !month2) return;

        const period1Month = `${year1}-${month1}`;
        const period2Month = `${year2}-${month2}`;

        data1 = getPeriodData({ type: 'month', yearMonth: period1Month });
        data2 = getPeriodData({ type: 'month', yearMonth: period2Month });

        p1Label = new Date(period1Month + '-02T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        p2Label = new Date(period2Month + '-02T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    }


    // Define a fixed order and selection of metrics to display for consistency.
    const metricsToDisplay = [
        'Reach', 'Impressions', 'Frequency', 'Link Clicks', 
        'CTR (%)', 'CPC', 'Spend', 'CPM', 'Transactions', 
        'CPA', 'AOV', 'Revenue', 'ROAS'
    ];
    
    let tableHTML = `<div class="overflow-x-auto"><table class="analyzer-table"><thead><tr>
        <th>Metric</th>
        <th>Period 1 (${p1Label})</th>
        <th>Period 2 (${p2Label})</th>
        <th>Delta</th>
        <th>Delta %</th>
    </tr></thead><tbody>`;

    metricsToDisplay.forEach(metric => {
        if (data1.hasOwnProperty(metric)) {
            const val1 = data1[metric] || 0;
            const val2 = data2[metric] || 0;
            const delta = val1 - val2;
            const deltaPercent = val2 !== 0 ? (delta / val2) * 100 : (val1 !== 0 ? Infinity : 0);
            
            const isNegativeGood = ['CPA', 'CPM', 'CPC'].includes(metric);
            let colorClass = '';
            if (delta > 0) colorClass = isNegativeGood ? 'delta-negative' : 'delta-positive';
            if (delta < 0) colorClass = isNegativeGood ? 'delta-positive' : 'delta-negative';

            const formatValue = (v, m) => {
                 if (['Spend', 'Revenue', 'AOV', 'CPA', 'CPM', 'CPC'].includes(m)) {
                    return `DKK ${v.toLocaleString('da-DK', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                 }
                 if (m === 'CTR (%)') return v.toFixed(2) + '%';
                 if (['Frequency', 'ROAS'].includes(m)) return v.toFixed(2);
                 return v.toLocaleString('de-DE'); // Use de-DE for dot thousands separators.
            };

            tableHTML += `<tr>
                <td class="font-semibold">
                    <span>${metric}</span>
                    <svg data-metric="${metric}" class="magnify-icon h-5 w-5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </td>
                <td>${formatValue(val1, metric)}</td>
                <td>${formatValue(val2, metric)}</td>
                <td class="${colorClass}">${formatValue(delta, metric)}</td>
                <td class="${colorClass}">${isFinite(deltaPercent) ? deltaPercent.toFixed(1) + '%' : 'N/A'}</td>
            </tr>`;
        }
    });

    tableHTML += '</tbody></table></div>';
    DOM.granulateModal.resultsContainer.innerHTML = tableHTML;
}


function showMetricChartModal(metric) {
    currentMetricDetail = metric; // Store in global state for theme changes
    renderMetricComparisonChart(metric);
    DOM.metricChartModal.modal.classList.replace('hidden', 'flex');
     setTimeout(() => {
        DOM.metricChartModal.backdrop.classList.add('open');
        DOM.metricChartModal.content.classList.add('open');
    }, 10);
}

function hideMetricChartModal() {
    if(metricDetailChart) metricDetailChart.destroy();
    metricDetailChart = null;
    currentMetricDetail = null;
    DOM.metricChartModal.backdrop.classList.remove('open');
    DOM.metricChartModal.content.classList.remove('open');
    setTimeout(() => DOM.metricChartModal.modal.classList.replace('flex', 'hidden'), 300);
}

function renderMetricComparisonChart(metric) {
    let dataPeriod1, dataPeriod2;
    let p1Label, p2Label;

    if (granulationMode === 'monthOverMonth') {
        const selectedMonth = document.getElementById('granulate-month-select').value;
        const period1Month = selectedMonth;
        const date = new Date(selectedMonth + '-02T00:00:00Z');
        date.setUTCMonth(date.getUTCMonth() - 1);
        const period2Month = date.toISOString().substring(0, 7);

        dataPeriod1 = analyzerData.filter(d => d.Day.startsWith(period1Month)).map(d => processedAnalyzerData[analyzerData.indexOf(d)][metric]);
        dataPeriod2 = analyzerData.filter(d => d.Day.startsWith(period2Month)).map(d => processedAnalyzerData[analyzerData.indexOf(d)][metric]);
        
        p1Label = `Period 1 (${period1Month})`;
        p2Label = `Period 2 (${period2Month})`;

    } else { // Custom mode
        const year1 = document.getElementById('granulate-year1-select').value;
        const month1 = document.getElementById('granulate-month1-select').value;
        const year2 = document.getElementById('granulate-year2-select').value;
        const month2 = document.getElementById('granulate-month2-select').value;
        const period1Month = `${year1}-${month1}`;
        const period2Month = `${year2}-${month2}`;

        dataPeriod1 = analyzerData.filter(d => d.Day.startsWith(period1Month)).map(d => processedAnalyzerData[analyzerData.indexOf(d)][metric]);
        dataPeriod2 = analyzerData.filter(d => d.Day.startsWith(period2Month)).map(d => processedAnalyzerData[analyzerData.indexOf(d)][metric]);
        
        p1Label = `Period 1 (${period1Month})`;
        p2Label = `Period 2 (${period2Month})`;
    }

    const maxDays = Math.max(dataPeriod1.length, dataPeriod2.length);
    const labels = Array.from({ length: maxDays }, (_, i) => `Day ${i + 1}`);
    
    if(metricDetailChart) metricDetailChart.destroy();
    const themeColors = getThemeColors();

    DOM.metricChartModal.title.textContent = `${metric} Trend Comparison`;

    metricDetailChart = new Chart(DOM.metricChartModal.canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: p1Label, data: dataPeriod1, borderColor: themeColors.primary, tension: 0.4 },
                { label: p2Label, data: dataPeriod2, borderColor: themeColors.secondary, tension: 0.4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: themeColors.legend } },
                title: { display: false }
            },
            scales: {
                x: { ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } },
                y: { ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (DOM && DOM.analyzer && DOM.analyzer.granulateBtn) {
        DOM.analyzer.granulateBtn.addEventListener('click', showGranulateModal);
        DOM.granulateModal.closeBtn.addEventListener('click', hideGranulateModal);
        DOM.granulateModal.backdrop.addEventListener('click', hideGranulateModal);
    }
});