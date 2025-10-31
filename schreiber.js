document.addEventListener('DOMContentLoaded', () => {
    // This file should be loaded after script.js to have access to getThemeColors
    if (typeof getThemeColors !== 'function' || typeof throttle !== 'function') {
        console.error("Schreiber app requires getThemeColors and throttle function from script.js");
        return;
    }

    const DOM = {
        view: document.getElementById('schreiber-view'),
        totalBudget: document.getElementById('schreiber-total-budget'),
        metaPercentage: document.getElementById('schreiber-meta-percentage'),
        googlePercentage: document.getElementById('schreiber-google-percentage'),
        metaResult: document.getElementById('schreiber-meta-result'),
        googleResult: document.getElementById('schreiber-google-result'),
        metaValueSpan: document.getElementById('schreiber-meta-value'),
        googleValueSpan: document.getElementById('schreiber-google-value'),
        darkModeCheckbox: document.getElementById('dark-mode-checkbox'),
    };

    function calculateSchreiberAllocation() {
        if (!DOM.totalBudget) return;

        const totalBudget = parseFloat(DOM.totalBudget.value) || 0;
        const metaPercent = parseFloat(DOM.metaPercentage.value) || 0;
        const googlePercent = parseFloat(DOM.googlePercentage.value) || 0;

        const metaAllocation = totalBudget * (metaPercent / 100);
        const googleAllocation = totalBudget * (googlePercent / 100);
        
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        const metaDailySpend = daysInMonth > 0 ? metaAllocation / daysInMonth : 0;
        const googleDailySpend = daysInMonth > 0 ? googleAllocation / daysInMonth : 0;

        const formatCurrency = (val) => `DKK ${val.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        DOM.metaResult.querySelector('p.text-2xl').textContent = formatCurrency(metaAllocation);
        DOM.googleResult.querySelector('p.text-2xl').textContent = formatCurrency(googleAllocation);

        DOM.metaResult.querySelector('p:last-child').textContent = `${formatCurrency(metaDailySpend)} / day`;
        DOM.googleResult.querySelector('p:last-child').textContent = `${formatCurrency(googleDailySpend)} / day`;
    }

    function handleSchreiberSliders(event) {
        if (!DOM.metaPercentage) return;

        const metaSlider = DOM.metaPercentage;
        const googleSlider = DOM.googlePercentage;
        const metaValueSpan = DOM.metaValueSpan;
        const googleValueSpan = DOM.googleValueSpan;

        const changedSlider = event.target;
        let metaValue = parseInt(metaSlider.value, 10);
        let googleValue = parseInt(googleSlider.value, 10);

        if (changedSlider.id === metaSlider.id) {
            googleValue = 100 - metaValue;
            googleSlider.value = googleValue;
        } else {
            metaValue = 100 - googleValue;
            metaSlider.value = metaValue;
        }

        metaValueSpan.textContent = `${metaValue}%`;
        googleValueSpan.textContent = `${googleValue}%`;

        setSliderBackgrounds();
        calculateSchreiberAllocation();
    }

    function setSliderBackgrounds() {
        if (!DOM.metaPercentage) return;
        
        const setSliderBg = (slider) => {
             const percentage = slider.value;
             const themeColors = getThemeColors();
             const inactiveColor = document.documentElement.classList.contains('dark') ? '#4b5563' : '#d1d5db';
             slider.style.background = `linear-gradient(to right, ${themeColors.primary} ${percentage}%, ${inactiveColor} ${percentage}%)`;
        }
        setSliderBg(DOM.metaPercentage);
        setSliderBg(DOM.googlePercentage);
    }

    // Add event listeners if the view exists
    if (DOM.view) {
        const throttledSchreiberCalc = throttle(calculateSchreiberAllocation, 150);
        const throttledSliderHandler = throttle(handleSchreiberSliders, 150);

        DOM.totalBudget.addEventListener('input', throttledSchreiberCalc);
        DOM.metaPercentage.addEventListener('input', throttledSliderHandler);
        DOM.googlePercentage.addEventListener('input', throttledSliderHandler);
        
        // Listener to re-render slider styles on theme change
        if (DOM.darkModeCheckbox) {
            DOM.darkModeCheckbox.addEventListener('change', setSliderBackgrounds);
        }

        // Initial setup
        handleSchreiberSliders({ target: DOM.metaPercentage });
    }
});