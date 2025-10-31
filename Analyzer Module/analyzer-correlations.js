// --- Correlations Modal Logic ---
function showCorrelationsModal() {
    populateCorrelationMetrics();
    calculateAndRenderCorrelation();
    DOM.correlationsModal.modal.classList.replace('hidden', 'flex');
    setTimeout(() => {
        DOM.correlationsModal.backdrop.classList.add('open');
        DOM.correlationsModal.content.classList.add('open');
    }, 10);
}

function hideCorrelationsModal() {
    if (correlationChart1) correlationChart1.destroy();
    if (correlationChart2) correlationChart2.destroy();
    correlationChart1 = null;
    correlationChart2 = null;
    DOM.correlationsModal.backdrop.classList.remove('open');
    DOM.correlationsModal.content.classList.remove('open');
    setTimeout(() => DOM.correlationsModal.modal.classList.replace('flex', 'hidden'), 300);
}

function populateCorrelationMetrics() {
    if (processedAnalyzerData.length === 0) return;
    const metrics = Object.keys(processedAnalyzerData[0]);
    const selects = [DOM.correlationsModal.metric1Select, DOM.correlationsModal.metric2Select];
    
    selects.forEach(select => {
        select.innerHTML = '';
        metrics.forEach(metric => {
            const option = document.createElement('option');
            option.value = metric;
            option.textContent = metric;
            select.appendChild(option);
        });
    });

    DOM.correlationsModal.metric1Select.value = 'Spend';
    DOM.correlationsModal.metric2Select.value = 'Revenue';
}

function calculateAndRenderCorrelation() {
    const { aggregatedData, labels } = aggregateData(correlationTimeAggregation);
    if (!aggregatedData || aggregatedData.length === 0) {
         DOM.correlationsModal.value.textContent = 'N/A';
         DOM.correlationsModal.marker.style.left = '50%';
         return;
    };

    const metric1 = DOM.correlationsModal.metric1Select.value;
    const metric2 = DOM.correlationsModal.metric2Select.value;
    
    const data1 = aggregatedData.map(row => row[metric1]);
    const data2 = aggregatedData.map(row => row[metric2]);

    const correlation = correl(data1, data2);
    
    DOM.correlationsModal.value.textContent = isNaN(correlation) ? 'N/A' : correlation.toFixed(4);
    const markerPosition = (correlation + 1) / 2 * 100;
    DOM.correlationsModal.marker.style.left = `calc(${markerPosition}% - 10px)`; 

    renderCorrelationCharts(aggregatedData, labels);
    renderDataPeriodIndicator(labels);
}

function renderCorrelationCharts(aggregatedData, labels) {
    if (correlationChart1) correlationChart1.destroy();
    if (correlationChart2) correlationChart2.destroy();
    
    const metric1 = DOM.correlationsModal.metric1Select.value;
    const metric2 = DOM.correlationsModal.metric2Select.value;

    const data1 = aggregatedData.map(row => row[metric1]);
    const data2 = aggregatedData.map(row => row[metric2]);

    const themeColors = getThemeColors();
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } },
            y: { ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }
        },
        plugins: {
            legend: { display: false },
            title: { display: true, text: 'Metric Trend', color: themeColors.title, font: { size: 16 } }
        }
    };

    correlationChart1 = new Chart(DOM.correlationsModal.chart1Canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{ data: data1, borderColor: themeColors.primary, backgroundColor: themeColors.primaryRgba, fill: true, tension: 0.4 }]
        },
        options: { ...options, plugins: { ...options.plugins, title: { ...options.plugins.title, text: metric1 } } }
    });

    correlationChart2 = new Chart(DOM.correlationsModal.chart2Canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{ data: data2, borderColor: themeColors.secondary, backgroundColor: themeColors.secondaryRgba, fill: true, tension: 0.4 }]
        },
        options: { ...options, plugins: { ...options.plugins, title: { ...options.plugins.title, text: metric2 } } }
    });
}

function renderDataPeriodIndicator(labels) {
    if (!labels || labels.length === 0 || analyzerData.length === 0) {
         DOM.correlationsModal.dataPeriodIndicator.textContent = '';
        return;
    }
    const firstDate = new Date(analyzerData[0].Day);
    const lastDate = new Date(analyzerData[analyzerData.length - 1].Day);

    const getHalf = (date) => (date.getMonth() < 6 ? 'H1' : 'H2');
    const firstHalf = `${getHalf(firstDate)} ${firstDate.getFullYear()}`;
    const lastHalf = `${getHalf(lastDate)} ${lastDate.getFullYear()}`;

    if (firstHalf === lastHalf) {
        DOM.correlationsModal.dataPeriodIndicator.textContent = `Data from: ${firstHalf}`;
    } else {
        DOM.correlationsModal.dataPeriodIndicator.textContent = `Data spans: ${firstHalf} to ${lastHalf}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (DOM && DOM.analyzer && DOM.analyzer.correlationsBtn) {
        DOM.analyzer.correlationsBtn.addEventListener('click', showCorrelationsModal);
        DOM.correlationsModal.closeBtn.addEventListener('click', hideCorrelationsModal);
        DOM.correlationsModal.backdrop.addEventListener('click', hideCorrelationsModal);
    }
});