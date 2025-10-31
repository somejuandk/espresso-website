document.addEventListener('DOMContentLoaded', () => {
    // This file should be loaded after script.js to have access to getThemeColors
    if (typeof getThemeColors !== 'function' || typeof throttle !== 'function') {
        console.error("BudgetPacer requires getThemeColors and throttle function from script.js");
        return;
    }

    let pacingChart = null;

    const DOM = {
        view: document.getElementById('budget-pacer-view'),
        budget: document.getElementById('pacing-budget'),
        brandingSlider: document.getElementById('pacing-branding-slider'),
        brandingValue: document.getElementById('pacing-branding-value'),
        daysRemaining: document.getElementById('pacing-days-remaining'),
        amountSpent: document.getElementById('pacing-amount-spent'),
        resultsContainer: document.getElementById('pacing-results'),
        chartCanvas: document.getElementById('pacing-chart'),
        darkModeCheckbox: document.getElementById('dark-mode-checkbox'),
    };

    const PACING_CAMPAIGN_DOM = {
        btn: document.getElementById('campaign-pacing-btn'),
        modal: document.getElementById('campaign-pacing-modal'),
        backdrop: document.getElementById('campaign-pacing-backdrop'),
        closeBtn: document.getElementById('campaign-pacing-close-btn'),
        addBtn: document.getElementById('add-campaign-row-btn'),
        tableBody: document.getElementById('campaign-pacing-table-body'),
        modalBrandingSlider: document.getElementById('pacing-modal-branding-slider'),
        modalBrandingValue: document.getElementById('pacing-modal-branding-value'),
    };

    function initializePacer() {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const today = now.getDate();
        if (DOM.daysRemaining) {
            DOM.daysRemaining.value = daysInMonth - today;
        }
        runAndRenderPacingAnalysis();
    }

    function runAndRenderPacingAnalysis() {
        if (!DOM.budget) return; // Don't run if the view isn't present

        const totalBudget = parseFloat(DOM.budget.value) || 0;
        const brandingPercent = parseInt(DOM.brandingSlider.value, 10);
        DOM.brandingValue.textContent = `${brandingPercent}%`;
        
        const daysRemaining = parseInt(DOM.daysRemaining.value, 10);
        const amountSpent = parseFloat(DOM.amountSpent.value) || 0;

        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentDayOfMonth = daysInMonth - daysRemaining;

        // Sync with modal slider if open
        if (PACING_CAMPAIGN_DOM.modal && PACING_CAMPAIGN_DOM.modal.classList.contains('flex')) {
            PACING_CAMPAIGN_DOM.modalBrandingSlider.value = brandingPercent;
            PACING_CAMPAIGN_DOM.modalBrandingValue.textContent = `${brandingPercent}%`;
        }


        if (totalBudget <= 0 || daysInMonth <= 0 || currentDayOfMonth < 0 || daysRemaining < 0) {
            DOM.resultsContainer.innerHTML = '<p class="text-gray-500 text-center">Please enter valid inputs to see the analysis.</p>';
            if(pacingChart) pacingChart.destroy();
            pacingChart = null;
            return;
        };

        const idealTotalDailySpend = totalBudget / daysInMonth;
        const expectedTotalSpend = idealTotalDailySpend * currentDayOfMonth;
        const pacingVariance = amountSpent - expectedTotalSpend;
        const pacePercentage = expectedTotalSpend > 0 ? (amountSpent / expectedTotalSpend) * 100 : 100;
        
        const actualDailySpend = currentDayOfMonth > 0 ? amountSpent / currentDayOfMonth : (daysRemaining > 0 ? (totalBudget - amountSpent) / daysRemaining : 0);
        const projectedEndOfMonthSpend = (currentDayOfMonth > 0) ? (amountSpent + (actualDailySpend * daysRemaining)) : totalBudget;

        let status, colorClass, recommendation;
        if (pacePercentage > 105) {
            status = `Over Pacing by ${((pacePercentage - 100)).toFixed(1)}%`;
            colorClass = 'text-red-600';
            recommendation = "Consider reducing daily spend to avoid exhausting the budget early.";
        } else if (pacePercentage < 95) {
            status = `Under Pacing by ${(100 - pacePercentage).toFixed(1)}%`;
            colorClass = 'text-[#5248e2]';
             recommendation = "Consider increasing daily spend to fully utilize the budget.";
        } else {
            status = "On Pace";
            colorClass = 'text-green-600';
            recommendation = "Current spending is aligned with the ideal pace. Keep it up!";
        }
        
        if (projectedEndOfMonthSpend > totalBudget * 1.01) {
            recommendation += ` At this rate, you're projected to overspend by about ${(projectedEndOfMonthSpend - totalBudget).toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}.`;
        } else if (projectedEndOfMonthSpend < totalBudget * 0.99) {
             recommendation += ` At this rate, you're projected to underspend by about ${(totalBudget - projectedEndOfMonthSpend).toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}.`;
        }

        const brandingBudget = totalBudget * (brandingPercent / 100);
        const performanceBudget = totalBudget - brandingBudget;
        const idealBrandingDailySpend = daysInMonth > 0 ? brandingBudget / daysInMonth : 0;
        const idealPerformanceDailySpend = daysInMonth > 0 ? performanceBudget / daysInMonth : 0;
        const amountSpentBranding = amountSpent * (brandingPercent / 100);
        const amountSpentPerformance = amountSpent - amountSpentBranding;
        const remainingBrandingBudget = brandingBudget - amountSpentBranding;
        const remainingPerformanceBudget = performanceBudget - amountSpentPerformance;
        const requiredBrandingDailySpend = daysRemaining > 0 ? remainingBrandingBudget / daysRemaining : 0;
        const requiredPerformanceDailySpend = daysRemaining > 0 ? remainingPerformanceBudget / daysRemaining : 0;

        DOM.resultsContainer.innerHTML = `
            <h4 class="text-lg font-semibold text-gray-800">Overall Pacing Analysis</h4>
            <div class="mt-2 space-y-2 text-sm">
                <p>Status: <strong class="${colorClass}">${status}</strong></p>
                <p>Ideal Spend to Date: <strong class="text-gray-900">${expectedTotalSpend.toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}</strong></p>
                <p>Pacing Variance: <strong class="${pacingVariance > 0 ? 'text-red-600' : 'text-green-600'}">${pacingVariance.toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}</strong></p>
                <p>Projected Month-End Spend: <strong class="text-gray-900 font-bold">${projectedEndOfMonthSpend.toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}</strong></p>
                <p class="text-xs text-gray-500 pt-2">${recommendation}</p>
            </div>

            <div class="border-t border-gray-200/50 pt-4 mt-4">
                <h4 class="text-lg font-semibold text-gray-800">Budget Allocation & Daily Spend</h4>
                <div class="mt-2 grid grid-cols-2 gap-4 text-sm">
                    <div class="space-y-1">
                        <p class="font-semibold text-gray-900">Branding (${brandingPercent}%)</p>
                        <p>Total Budget: <strong class="text-gray-800">${brandingBudget.toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}</strong></p>
                        <p>Ideal Daily Spend: <strong class="text-gray-800">${idealBrandingDailySpend.toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}</strong></p>
                        <p>Req. Daily Spend: <strong class="text-[#5248e2] font-bold">${requiredBrandingDailySpend.toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}</strong></p>
                    </div>
                    <div class="space-y-1">
                        <p class="font-semibold text-gray-900">Performance (${100 - brandingPercent}%)</p>
                        <p>Total Budget: <strong class="text-gray-800">${performanceBudget.toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}</strong></p>
                        <p>Ideal Daily Spend: <strong class="text-gray-800">${idealPerformanceDailySpend.toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}</strong></p>
                        <p>Req. Daily Spend: <strong class="text-[#5248e2] font-bold">${requiredPerformanceDailySpend.toLocaleString('da-DK', {style: 'currency', currency: 'DKK'})}</strong></p>
                    </div>
                </div>
            </div>
        `;

        renderPacingChart(daysInMonth, idealTotalDailySpend, amountSpent, currentDayOfMonth, totalBudget);
        redistributeWeightsAndCalculate(); // Link slider to modal weights
    }

    function renderPacingChart(daysInMonth, idealDailySpend, amountSpent, currentDayOfMonth, totalBudget) {
        if(pacingChart) pacingChart.destroy();
        const themeColors = getThemeColors();

        const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
        
        const idealData = labels.map(day => idealDailySpend * day);
        
        const actualDailySpend = currentDayOfMonth > 0 ? amountSpent / currentDayOfMonth : 0;
        const actualData = labels.map(day => day <= currentDayOfMonth ? (actualDailySpend * day) : null);
        
        const projectedData = Array(daysInMonth).fill(null);
        if (currentDayOfMonth > 0 && currentDayOfMonth < daysInMonth) {
            projectedData[currentDayOfMonth - 1] = amountSpent;
            
            for(let i = currentDayOfMonth; i < daysInMonth; i++) {
                projectedData[i] = amountSpent + (actualDailySpend * (i + 1 - currentDayOfMonth));
            }
        }

        pacingChart = new Chart(DOM.chartCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Ideal Spend', data: idealData, borderColor: '#9ca3af', borderWidth: 2, pointRadius: 0, borderDash: [5, 5] },
                    { label: 'Actual Spend', data: actualData, borderColor: themeColors.primary, borderWidth: 3, pointRadius: 0, spanGaps: false },
                    { label: 'Projected Spend', data: projectedData, borderColor: themeColors.secondary, borderWidth: 2, pointRadius: 0, borderDash: [10, 5], spanGaps: false }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Day of Month', color: themeColors.ticks}, ticks: { color: themeColors.ticks }, grid: { display: false } },
                    y: { title: { display: true, text: 'Cumulative Spend (DKK)', color: themeColors.ticks}, ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid } }
                },
                plugins: { 
                    legend: { 
                        position: 'top',
                        labels: { 
                            color: themeColors.legend
                        }
                    }, 
                    title: { display: true, text: 'Budget Pacing vs. Ideal', color: themeColors.title, font: {size: 16}} 
                }
            }
        });
    }

    // --- Campaign Pacing Modal Logic ---
    function showCampaignPacingModal() {
        if (!PACING_CAMPAIGN_DOM.modal) return;
        
        // Sync slider value when opening
        if (PACING_CAMPAIGN_DOM.modalBrandingSlider && DOM.brandingSlider) {
            PACING_CAMPAIGN_DOM.modalBrandingSlider.value = DOM.brandingSlider.value;
        }
        if (PACING_CAMPAIGN_DOM.modalBrandingValue && DOM.brandingValue) {
            PACING_CAMPAIGN_DOM.modalBrandingValue.textContent = DOM.brandingValue.textContent;
        }

        PACING_CAMPAIGN_DOM.modal.classList.replace('hidden', 'flex');
        setTimeout(() => {
            PACING_CAMPAIGN_DOM.backdrop.classList.add('open');
            PACING_CAMPAIGN_DOM.modal.querySelector('.modal-content').classList.add('open');
            if (PACING_CAMPAIGN_DOM.tableBody.children.length === 0) {
                addCampaignRow();
                addCampaignRow();
            }
            redistributeWeightsAndCalculate();
        }, 10);
    }

    function hideCampaignPacingModal() {
        if (!PACING_CAMPAIGN_DOM.modal) return;
        PACING_CAMPAIGN_DOM.backdrop.classList.remove('open');
        PACING_CAMPAIGN_DOM.modal.querySelector('.modal-content').classList.remove('open');
        setTimeout(() => PACING_CAMPAIGN_DOM.modal.classList.replace('flex', 'hidden'), 300);
    }

    function addCampaignRow() {
        if (!PACING_CAMPAIGN_DOM.tableBody) return;
        const row = document.createElement('tr');
        row.className = 'campaign-pacing-row';
        row.innerHTML = `
            <td class="p-1"><input type="text" class="styled-input w-full p-2 rounded-lg" placeholder="e.g., Prospecting Campaign"></td>
            <td class="p-1 text-center"><input type="checkbox" class="custom-checkbox campaign-branding-checkbox"></td>
            <td class="p-1">
                <div class="relative">
                    <input type="number" data-type="weight" class="styled-input w-full p-2 rounded-lg text-center pr-6" value="0" min="0" step="0.01">
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">%</span>
                </div>
            </td>
            <td class="p-1"><input type="text" class="styled-input w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-center" readonly></td>
            <td class="p-1"><input type="text" class="styled-input w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-center" readonly></td>
            <td class="p-1 text-center">
                <button class="delete-campaign-row-btn text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </td>
        `;
        PACING_CAMPAIGN_DOM.tableBody.appendChild(row);
    }

    function redistributeWeightsAndCalculate() {
        if (!PACING_CAMPAIGN_DOM.modal.classList.contains('flex')) return;

        const brandingPercent = parseInt(DOM.brandingSlider.value, 10);
        const performancePercent = 100 - brandingPercent;

        const rows = Array.from(PACING_CAMPAIGN_DOM.tableBody.querySelectorAll('tr.campaign-pacing-row'));
        const brandingRows = rows.filter(r => r.querySelector('.campaign-branding-checkbox').checked);
        const performanceRows = rows.filter(r => !r.querySelector('.campaign-branding-checkbox').checked);

        if (brandingRows.length > 0) {
            const weight = brandingPercent / brandingRows.length;
            brandingRows.forEach(row => {
                const weightInput = row.querySelector('input[data-type="weight"]');
                weightInput.value = weight.toFixed(2);
            });
        }
        
        if (performanceRows.length > 0) {
            const weight = performancePercent / performanceRows.length;
            performanceRows.forEach(row => {
                const weightInput = row.querySelector('input[data-type="weight"]');
                weightInput.value = weight.toFixed(2);
            });
        }
    
        calculatePacingValues();
    }
    
    function handleManualWeightChange(event) {
        const changedInput = event.target;
        const changedRow = changedInput.closest('tr');
        if (!changedRow) return;
    
        const isBranding = changedRow.querySelector('.campaign-branding-checkbox').checked;
        const groupTotal = isBranding ? parseInt(DOM.brandingSlider.value, 10) : 100 - parseInt(DOM.brandingSlider.value, 10);
    
        const rows = Array.from(PACING_CAMPAIGN_DOM.tableBody.querySelectorAll('tr.campaign-pacing-row'));
        const groupRows = rows.filter(r => r.querySelector('.campaign-branding-checkbox').checked === isBranding);
        
        if (groupRows.length <= 1) {
            changedInput.value = groupTotal.toFixed(2);
            calculatePacingValues();
            return;
        }
    
        let newValue = parseFloat(changedInput.value);
        if (isNaN(newValue) || newValue < 0) newValue = 0;
        if (newValue > groupTotal) {
            newValue = groupTotal;
            changedInput.value = newValue.toFixed(2);
        }
    
        const otherRows = groupRows.filter(r => r !== changedRow);
        const remainingWeightToDistribute = groupTotal - newValue;
    
        const sumOfOtherOldWeights = otherRows.reduce((sum, r) => {
            return sum + (parseFloat(r.querySelector('input[data-type="weight"]').value) || 0);
        }, 0);
        
        if (sumOfOtherOldWeights > 0) {
            otherRows.forEach(row => {
                const weightInput = row.querySelector('input[data-type="weight"]');
                const oldWeight = parseFloat(weightInput.value) || 0;
                const newWeight = (oldWeight / sumOfOtherOldWeights) * remainingWeightToDistribute;
                weightInput.value = newWeight.toFixed(2);
            });
        } else if (otherRows.length > 0) {
            const equalWeight = remainingWeightToDistribute / otherRows.length;
            otherRows.forEach(row => {
                const weightInput = row.querySelector('input[data-type="weight"]');
                weightInput.value = equalWeight.toFixed(2);
            });
        }
    
        calculatePacingValues();
    }

    function calculatePacingValues() {
        if (!PACING_CAMPAIGN_DOM.modal || !DOM.budget) return;
    
        const totalBudget = parseFloat(DOM.budget.value) || 0;
        const daysRemaining = parseInt(DOM.daysRemaining.value, 10);
        const amountSpent = parseFloat(DOM.amountSpent.value) || 0;
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        const idealDailySpendTotal = daysInMonth > 0 ? totalBudget / daysInMonth : 0;
        const remainingBudget = totalBudget - amountSpent;
        const requiredDailySpendTotal = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

        const rows = PACING_CAMPAIGN_DOM.tableBody.querySelectorAll('tr.campaign-pacing-row');
        
        rows.forEach(row => {
            const weightInput = row.querySelector('input[data-type="weight"]');
            const originalPacingOutput = row.querySelectorAll('input[readonly]')[0];
            const newPacingOutput = row.querySelectorAll('input[readonly]')[1];
            
            const weight = parseFloat(weightInput.value) || 0;
            const weightFraction = weight / 100;
    
            const originalDailySpend = idealDailySpendTotal * weightFraction;
            const newDailySpend = requiredDailySpendTotal * weightFraction;
    
            const formatCurrency = val => isFinite(val) ? `DKK ${val.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
            
            originalPacingOutput.value = formatCurrency(originalDailySpend);
            newPacingOutput.value = formatCurrency(newDailySpend);
        });
    }

    // --- Event Listeners and Initialization ---

    // Observer to re-render chart when view becomes active, ensuring correct theme is applied
    const viewObserver = new MutationObserver(() => {
        if (DOM.view && !DOM.view.classList.contains('is-inactive')) {
            initializePacer();
        }
    });

    if (DOM.view) {
        viewObserver.observe(DOM.view, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    // Add event listeners for controls
    const throttledPacingAnalysis = throttle(runAndRenderPacingAnalysis, 150);
    [DOM.budget, DOM.brandingSlider, DOM.daysRemaining, DOM.amountSpent].forEach(el => {
        if (el) {
            el.addEventListener('input', throttledPacingAnalysis);
        }
    });
    
    // Campaign Pacing Event Listeners
    if (PACING_CAMPAIGN_DOM.btn) {
        PACING_CAMPAIGN_DOM.btn.addEventListener('click', showCampaignPacingModal);
    }
    if (PACING_CAMPAIGN_DOM.closeBtn) {
        PACING_CAMPAIGN_DOM.closeBtn.addEventListener('click', hideCampaignPacingModal);
    }
    if (PACING_CAMPAIGN_DOM.backdrop) {
        PACING_CAMPAIGN_DOM.backdrop.addEventListener('click', hideCampaignPacingModal);
    }
    if (PACING_CAMPAIGN_DOM.addBtn) {
        PACING_CAMPAIGN_DOM.addBtn.addEventListener('click', () => {
            addCampaignRow();
            redistributeWeightsAndCalculate();
        });
    }

    if (PACING_CAMPAIGN_DOM.modalBrandingSlider) {
        PACING_CAMPAIGN_DOM.modalBrandingSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            // Update main slider and its value
            DOM.brandingSlider.value = value;
            DOM.brandingValue.textContent = `${value}%`;
            // Update modal value display
            PACING_CAMPAIGN_DOM.modalBrandingValue.textContent = `${value}%`;
            // Recalculate everything
            redistributeWeightsAndCalculate();
        });
    }

    if (PACING_CAMPAIGN_DOM.tableBody) {
        const throttledManualChange = throttle(handleManualWeightChange, 200);
        PACING_CAMPAIGN_DOM.tableBody.addEventListener('input', (e) => {
            if (e.target.matches('input[data-type="weight"]')) {
                throttledManualChange(e);
            }
        });
        PACING_CAMPAIGN_DOM.tableBody.addEventListener('change', (e) => {
             if (e.target.matches('.campaign-branding-checkbox')) {
                redistributeWeightsAndCalculate();
            }
        });
        PACING_CAMPAIGN_DOM.tableBody.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-campaign-row-btn');
            if (deleteBtn) {
                deleteBtn.closest('tr').remove();
                redistributeWeightsAndCalculate();
            }
        });
    }

    // Initial check in case the app is loaded directly into this view
    if (DOM.view && !DOM.view.classList.contains('is-inactive')) {
        initializePacer();
    }
});