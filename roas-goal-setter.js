// --- Global Functions for ROAS Goal Setter ---
let historicalMetrics = null;
let validationChart = null;

function handleRoasFileContent(csvText, filename) {
    const DOM = {
        aovInput: document.getElementById('roas-goal-setter-aov'),
        cvrSlider: document.getElementById('roas-goal-setter-cvr-slider'),
        dropZone: document.getElementById('roas-file-drop-zone'),
    };
    try {
        const metrics = parseHistoricalData(csvText);
        if (metrics) {
            historicalMetrics = metrics;
            DOM.aovInput.value = historicalMetrics.aov.toFixed(2);
            DOM.cvrSlider.value = historicalMetrics.cvr.toFixed(2);

            addToFileLibrary({ name: filename, content: csvText, context: 'ROAS Goal Setter' });

            DOM.dropZone.classList.add('upload-success');
            DOM.dropZone.innerHTML = `
                <div class="success-animation-container">
                    <svg class="success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle class="success-checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                        <path class="success-checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                    <p class="text-lg font-semibold text-gray-800 mt-2">Success!</p>
                    <p class="text-sm text-green-600">Historical data applied.</p>
                </div>
            `;
            showNotification('Historical data imported successfully.', 'success');
            
            calculateAndRender();
            renderValidationChart();
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function handleRoasFile(file) {
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
        const reader = new FileReader();
        reader.onload = (e) => {
            handleRoasFileContent(e.target.result, file.name);
        };
        reader.readAsText(file);
    } else {
        showNotification('Please upload a valid .csv file.', 'error');
    }
}

function parseHistoricalData(csvText) {
    const rows = csvText.split('\n').filter(row => row.trim() !== '');
    if (rows.length < 2) throw new Error("CSV has no data rows.");
    
    const header = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const aliases = {
        revenue: ['website purchase conversion value', 'purchase conversion value', 'purchases conversion value', 'conv. value'],
        purchases: ['purchases'],
        linkClicks: ['link clicks', 'clicks']
    };

    const findIndex = (header, aliasList) => {
        for (const alias of aliasList) {
            const index = header.findIndex(h => h.toLowerCase() === alias);
            if (index !== -1) return index;
        }
        return -1;
    };

    const revenueIndex = findIndex(header, aliases.revenue);
    const purchasesIndex = findIndex(header, aliases.purchases);
    const linkClicksIndex = findIndex(header, aliases.linkClicks);

    if (revenueIndex === -1 || purchasesIndex === -1 || linkClicksIndex === -1) {
        throw new Error("CSV must contain columns for Revenue, Purchases, and Link Clicks.");
    }

    let totalRevenue = 0, totalPurchases = 0, totalLinkClicks = 0;
    
    rows.slice(1).forEach(row => {
        const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        if (values.length < header.length) return;
        
        totalRevenue += parseFloat(values[revenueIndex]) || 0;
        totalPurchases += parseInt(values[purchasesIndex], 10) || 0;
        totalLinkClicks += parseInt(values[linkClicksIndex], 10) || 0;
    });

    if (totalPurchases === 0 || totalLinkClicks === 0) {
        throw new Error("Not enough transaction or click data in the report to calculate metrics.");
    }
    
    const aov = totalRevenue / totalPurchases;
    const cvr = (totalPurchases / totalLinkClicks) * 100;
    
    return { aov, cvr };
}

function renderValidationChart() {
    if (validationChart) validationChart.destroy();
    if (!historicalMetrics) return;

    const validationChartContainer = document.getElementById('roas-validation-chart-container');
    const validationChartCanvas = document.getElementById('roas-validation-chart');
    const aovInput = document.getElementById('roas-goal-setter-aov');
    const cvrSlider = document.getElementById('roas-goal-setter-cvr-slider');

    validationChartContainer.classList.remove('hidden');
    const themeColors = getThemeColors();
    const ctx = validationChartCanvas.getContext('2d');
    
    const currentAov = parseFloat(aovInput.value) || 0;
    const currentCvr = parseFloat(cvrSlider.value) || 0;

    validationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Average Order Value (AOV)', 'Conversion Rate (CVR)'],
            datasets: [
                {
                    label: 'Historical Average',
                    data: [historicalMetrics.aov, historicalMetrics.cvr],
                    backgroundColor: 'rgba(156, 163, 175, 0.5)', // gray-400
                    borderColor: 'rgba(156, 163, 175, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Current Goal',
                    data: [currentAov, currentCvr],
                    backgroundColor: themeColors.primaryRgba_Bar,
                    borderColor: themeColors.primary,
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: themeColors.ticks },
                    grid: { color: themeColors.grid }
                },
                x: {
                    ticks: { color: themeColors.ticks },
                    grid: { display: false }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Goal vs. Historical Performance',
                    color: themeColors.title,
                    font: { size: 16 }
                },
                legend: {
                    labels: { color: themeColors.legend }
                }
            }
        }
    });
}

function updateValidationChart(currentAov, currentCvr) {
    if (!validationChart) return;
    validationChart.data.datasets[1].data = [currentAov, currentCvr];
    validationChart.update();
}

function calculateAndRender() {
    const DOM = {
        view: document.getElementById('roas-goal-setter-view'),
        targetRoasSlider: document.getElementById('roas-goal-setter-roas-slider'),
        targetRoasValue: document.getElementById('roas-goal-setter-roas-value'),
        aovInput: document.getElementById('roas-goal-setter-aov'),
        cvrSlider: document.getElementById('roas-goal-setter-cvr-slider'),
        cvrValue: document.getElementById('roas-goal-setter-cvr-value'),
        maxCpaOutput: document.getElementById('roas-goal-setter-max-cpa'),
        maxCpcOutput: document.getElementById('roas-goal-setter-max-cpc'),
        cpaGauge: {
            marker: document.getElementById('cpa-gauge-marker'),
            lowLabel: document.getElementById('cpa-gauge-low-label'),
            highLabel: document.getElementById('cpa-gauge-high-label'),
        },
        cpcGauge: {
            marker: document.getElementById('cpc-gauge-marker'),
            lowLabel: document.getElementById('cpc-gauge-low-label'),
            highLabel: document.getElementById('cpc-gauge-high-label'),
        },
        repeatRateSlider: document.getElementById('roas-goal-setter-repeat-rate-slider'),
        repeatRateValue: document.getElementById('roas-goal-setter-repeat-rate-value'),
        avgPurchasesSlider: document.getElementById('roas-goal-setter-avg-purchases-slider'),
        avgPurchasesValue: document.getElementById('roas-goal-setter-avg-purchases-value'),
        ltvCpaOutput: document.getElementById('roas-goal-setter-ltv-cpa'),
        cogsSlider: document.getElementById('roas-goal-setter-cogs-slider'),
        cogsValue: document.getElementById('roas-goal-setter-cogs-value'),
        profitMarginOutput: document.getElementById('roas-goal-setter-profit-margin'),
        beRoasOutput: document.getElementById('roas-goal-setter-be-roas'),
        beRoasMarker: document.getElementById('roas-goal-setter-be-roas-marker'),
        profitPerTxOutput: document.getElementById('roas-goal-setter-profit-per-tx'),
        summaryBox: document.getElementById('roas-summary-box'),
        summaryTargetRoas: document.getElementById('summary-target-roas'),
        summaryMaxCpa: document.getElementById('summary-max-cpa'),
        summaryMaxCpc: document.getElementById('summary-max-cpc'),
        summaryBeRoas: document.getElementById('summary-be-roas'),
        summaryLtvCpa: document.getElementById('summary-ltv-cpa'),
        summaryProfitPerTx: document.getElementById('summary-profit-per-tx'),
    };

    if (!DOM.view) return;
    
    const targetRoas = parseFloat(DOM.targetRoasSlider.value);
    const aov = parseFloat(DOM.aovInput.value) || 0;
    const cvr = parseFloat(DOM.cvrSlider.value);

    DOM.targetRoasValue.textContent = targetRoas.toFixed(2);
    DOM.cvrValue.textContent = `${cvr.toFixed(2)}%`;

    const formatCurrency = val => `DKK ${val.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const cogsPercent = parseFloat(DOM.cogsSlider.value);
    DOM.cogsValue.textContent = `${cogsPercent.toFixed(1)}%`;

    const profitMarginDecimal = 1 - (cogsPercent / 100);
    const breakEvenRoas = profitMarginDecimal > 0 ? 1 / profitMarginDecimal : Infinity;

    DOM.profitMarginOutput.textContent = `${(profitMarginDecimal * 100).toFixed(1)}%`;
    DOM.beRoasOutput.textContent = isFinite(breakEvenRoas) ? breakEvenRoas.toFixed(2) : 'N/A';

    if (isFinite(breakEvenRoas) && breakEvenRoas >= 1 && breakEvenRoas <= 20) {
        const sliderMin = parseFloat(DOM.targetRoasSlider.min);
        const sliderMax = parseFloat(DOM.targetRoasSlider.max);
        const markerPercent = ((breakEvenRoas - sliderMin) / (sliderMax - sliderMin)) * 100;
        DOM.beRoasMarker.style.left = `calc(${markerPercent}% - 2px)`;
        DOM.beRoasMarker.style.display = 'block';
        DOM.beRoasMarker.dataset.tooltip = `Break-Even ROAS: ${breakEvenRoas.toFixed(2)}`;
    } else {
        DOM.beRoasMarker.style.display = 'none';
    }

    const maxCpa = (aov > 0 && targetRoas > 0) ? aov / targetRoas : 0;
    const maxCpc = maxCpa * (cvr / 100);

    const profitPerTx = aov * profitMarginDecimal - maxCpa;
    DOM.profitPerTxOutput.textContent = `Profit/Tx: ${formatCurrency(profitPerTx)}`;
    
    const profitElements = [DOM.profitPerTxOutput, DOM.summaryProfitPerTx];
    profitElements.forEach(el => {
        if (!el) return;
        el.classList.remove('text-green-600', 'text-red-600', 'text-gray-600', 'dark:text-gray-300');
        if (profitPerTx > 0.01) {
            el.classList.add('text-green-600');
        } else if (profitPerTx < -0.01) {
            el.classList.add('text-red-600');
        } else {
            el.classList.add('text-gray-600', 'dark:text-gray-300');
        }
    });

    DOM.maxCpaOutput.textContent = formatCurrency(maxCpa);
    DOM.maxCpcOutput.textContent = formatCurrency(maxCpc);

    const aovLow = aov * 0.9, aovHigh = aov * 1.1;
    const cpaLow = (aovLow / targetRoas) || 0, cpaHigh = (aovHigh / targetRoas) || 0;
    DOM.cpaGauge.lowLabel.textContent = formatCurrency(cpaLow);
    DOM.cpaGauge.highLabel.textContent = formatCurrency(cpaHigh);
    DOM.cpaGauge.marker.style.left = '50%';
    DOM.cpaGauge.marker.dataset.tooltip = `With AOV at ${formatCurrency(aov)}, Max CPA is ${formatCurrency(maxCpa)}. Range shows results for AOV ±10%.`;

    const cvrLow = cvr * 0.9, cvrHigh = cvr * 1.1;
    const cpcLow = maxCpa * (cvrLow / 100), cpcHigh = maxCpa * (cvrHigh / 100);
    DOM.cpcGauge.lowLabel.textContent = formatCurrency(cpcLow);
    DOM.cpcGauge.highLabel.textContent = formatCurrency(cpcHigh);
    DOM.cpcGauge.marker.style.left = '50%';
    DOM.cpcGauge.marker.dataset.tooltip = `With CVR at ${cvr.toFixed(2)}%, Max CPC is ${formatCurrency(maxCpc)}. Range shows results for CVR ±10%.`;
    
    const repeatRate = parseFloat(DOM.repeatRateSlider.value);
    const avgAdditionalPurchases = parseFloat(DOM.avgPurchasesSlider.value);
    DOM.repeatRateValue.textContent = `${repeatRate.toFixed(1)}%`;
    DOM.avgPurchasesValue.textContent = avgAdditionalPurchases.toFixed(2);

    const lifetimeMultiplier = 1 + (repeatRate / 100 * avgAdditionalPurchases);
    const ltv = aov * lifetimeMultiplier;
    const ltvCpa = (ltv > 0 && targetRoas > 0) ? ltv / targetRoas : 0;
    DOM.ltvCpaOutput.textContent = formatCurrency(ltvCpa);
    
    if (DOM.summaryBox) {
        DOM.summaryTargetRoas.textContent = targetRoas.toFixed(2);
        DOM.summaryMaxCpa.textContent = formatCurrency(maxCpa);
        DOM.summaryMaxCpc.textContent = formatCurrency(maxCpc);
        DOM.summaryBeRoas.textContent = isFinite(breakEvenRoas) ? breakEvenRoas.toFixed(2) : 'N/A';
        DOM.summaryLtvCpa.textContent = formatCurrency(ltvCpa);
        DOM.summaryProfitPerTx.textContent = formatCurrency(profitPerTx);
    }

    if (validationChart) {
        updateValidationChart(aov, cvr);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const DOM = {
        view: document.getElementById('roas-goal-setter-view'),
        targetRoasSlider: document.getElementById('roas-goal-setter-roas-slider'),
        aovInput: document.getElementById('roas-goal-setter-aov'),
        cvrSlider: document.getElementById('roas-goal-setter-cvr-slider'),
        repeatRateSlider: document.getElementById('roas-goal-setter-repeat-rate-slider'),
        avgPurchasesSlider: document.getElementById('roas-goal-setter-avg-purchases-slider'),
        cogsSlider: document.getElementById('roas-goal-setter-cogs-slider'),
        fileInput: document.getElementById('roas-file-input'),
        dropZone: document.getElementById('roas-file-drop-zone'),
    };
    
    if (DOM.view) {
        window.fileHandlers['roas-goal-setter'] = handleRoasFileContent;

        const throttledCalculateAndRender = throttle(calculateAndRender, 150);
        [DOM.targetRoasSlider, DOM.aovInput, DOM.cvrSlider, DOM.repeatRateSlider, DOM.avgPurchasesSlider, DOM.cogsSlider].forEach(el => {
            if (el) el.addEventListener('input', throttledCalculateAndRender);
        });
        
        DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
        DOM.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleRoasFile(e.target.files[0]);
            e.target.value = ''; // Reset for same-file upload
        });
        DOM.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); DOM.dropZone.classList.add('dragover'); });
        DOM.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); DOM.dropZone.classList.remove('dragover'); });
        DOM.dropZone.addEventListener('drop', (e) => {
             e.preventDefault();
             e.stopPropagation();
             DOM.dropZone.classList.remove('dragover');
             if (e.dataTransfer.files.length > 0) handleRoasFile(e.dataTransfer.files[0]);
        });
        
        calculateAndRender();
    }
});