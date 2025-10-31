// --- Best/Worst Periods Modal Logic ---
function showBestWorstModal() {
    populateBestWorstMetrics();
    runAndRenderBestWorstAnalysis();
    DOM.bestWorstModal.modal.classList.replace('hidden', 'flex');
    setTimeout(() => {
        DOM.bestWorstModal.backdrop.classList.add('open');
        DOM.bestWorstModal.content.classList.add('open');
    }, 10);
}

function hideBestWorstModal() {
    DOM.bestWorstModal.backdrop.classList.remove('open');
    DOM.bestWorstModal.content.classList.remove('open');
    setTimeout(() => DOM.bestWorstModal.modal.classList.replace('flex', 'hidden'), 300);
}

function populateBestWorstMetrics() {
    if (processedAnalyzerData.length === 0) return;
    const metrics = Object.keys(processedAnalyzerData[0]);
    const select = DOM.bestWorstModal.metricSelect;
    
    // Preserve selected value if it exists
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
        select.value = 'ROAS'; // A sensible default
    }
}

function runAndRenderBestWorstAnalysis() {
    const { aggregatedData, labels } = aggregateData(bestWorstTimeAggregation);
    if (!aggregatedData || aggregatedData.length === 0) return;

    const metric = DOM.bestWorstModal.metricSelect.value;
    const isAscending = ['CPA', 'CPC', 'CPM'].includes(metric);

    const combinedAndLabeledData = aggregatedData.map((row, index) => ({
        ...row,
        periodLabel: labels[index]
    }));
    
    const sortedData = [...combinedAndLabeledData].sort((a, b) => {
        return isAscending ? a[metric] - b[metric] : b[metric] - a[metric];
    });

    const bestPeriods = sortedData.slice(0, 5);
    const worstPeriods = sortedData.slice(-5).reverse();

    DOM.bestWorstModal.resultsContainer.innerHTML = `
        <div>${createBestWorstTable('Best 5 Periods', bestPeriods, metric)}</div>
        <div>${createBestWorstTable('Worst 5 Periods', worstPeriods, metric)}</div>
    `;
}

function createBestWorstTable(title, data, primaryMetric) {
    const headersSet = new Set([primaryMetric]);
    ['Spend', 'Revenue', 'Transactions', 'ROAS', 'CPA'].forEach(h => headersSet.add(h));
    const allHeaders = Array.from(headersSet);
    
    let tableHTML = `
        <h4 class="text-lg font-semibold text-gray-900 mb-2">${title}</h4>
        <div class="overflow-x-auto glass-container rounded-xl">
            <table class="analyzer-table text-sm">
                <thead>
                    <tr>
                        <th class="capitalize">${bestWorstTimeAggregation.slice(0,-2)}</th>
                        ${allHeaders.map(h => `<th class="${h === primaryMetric ? 'bg-[#c8d2fe]' : ''}">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(period => {
        tableHTML += `<tr>`;
        tableHTML += `<td class="font-semibold">${period.periodLabel}</td>`;
        allHeaders.forEach(header => {
            const value = period[header];
            const formattedValue = typeof value === 'number' ? value.toLocaleString('da-DK', { maximumFractionDigits: 2}) : value;
            tableHTML += `<td class="${header === primaryMetric ? 'bg-[#c8d2fe] font-bold' : ''}">${formattedValue}</td>`;
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    return tableHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    if (DOM && DOM.analyzer && DOM.analyzer.bestWorstBtn) {
        DOM.analyzer.bestWorstBtn.addEventListener('click', showBestWorstModal);
        DOM.bestWorstModal.closeBtn.addEventListener('click', hideBestWorstModal);
        DOM.bestWorstModal.backdrop.addEventListener('click', hideBestWorstModal);
    }
});