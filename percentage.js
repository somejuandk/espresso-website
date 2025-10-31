document.addEventListener('DOMContentLoaded', () => {

    const percentageDOM = {
        tabs: document.querySelectorAll('.percentage-tab'),
        tabContents: document.querySelectorAll('.percentage-tab-content'),
        // 'percent-of' calculator
        percentOfX: document.getElementById('percent-of-x'),
        percentOfY: document.getElementById('percent-of-y'),
        percentOfResult: document.getElementById('percent-of-result'),
        // 'is-what-percent' calculator
        isWhatX: document.getElementById('is-what-x'),
        isWhatY: document.getElementById('is-what-y'),
        isWhatResult: document.getElementById('is-what-result'),
        // 'percent-change' calculator
        changeFromX: document.getElementById('change-from-x'),
        changeToY: document.getElementById('change-to-y'),
        changeResult: document.getElementById('change-result'),
        // All inputs in the percentage calculator
        allInputs: document.querySelectorAll('#percentage-view .styled-input'),
    };

    // --- Tab Switching Logic ---
    percentageDOM.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all tabs
            percentageDOM.tabs.forEach(t => t.classList.remove('active'));
            percentageDOM.tabContents.forEach(c => c.classList.add('hidden'));

            // Activate clicked tab
            tab.classList.add('active');
            const tabContentId = `${tab.dataset.tab}-tab`;
            document.getElementById(tabContentId).classList.remove('hidden');
        });
    });

    // --- Input Styling Logic ---
    function handleInputStyling(event) {
        const input = event.target;
        // Add or remove 'has-content' class based on whether the input has a value
        input.classList.toggle('has-content', input.value.trim() !== '');
    }

    percentageDOM.allInputs.forEach(input => {
        input.addEventListener('input', handleInputStyling);
    });

    // --- Calculation Functions ---
    function calculatePercentOf() {
        const x = parseFloat(percentageDOM.percentOfX.value);
        const y = parseFloat(percentageDOM.percentOfY.value);

        if (isNaN(x) || isNaN(y)) {
            percentageDOM.percentOfResult.textContent = '-';
            return;
        }

        const result = (x / 100) * y;
        percentageDOM.percentOfResult.textContent = result.toLocaleString('en-US');
    }

    function calculateIsWhatPercent() {
        const x = parseFloat(percentageDOM.isWhatX.value);
        const y = parseFloat(percentageDOM.isWhatY.value);

        if (isNaN(x) || isNaN(y)) {
            percentageDOM.isWhatResult.textContent = '-';
            return;
        }

        if (y === 0) {
            percentageDOM.isWhatResult.textContent = 'Cannot divide by zero';
            return;
        }

        const result = (x / y) * 100;
        percentageDOM.isWhatResult.textContent = `${result.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
    }

    function calculatePercentChange() {
        const x = parseFloat(percentageDOM.changeFromX.value);
        const y = parseFloat(percentageDOM.changeToY.value);

        if (isNaN(x) || isNaN(y)) {
            percentageDOM.changeResult.textContent = '-';
            return;
        }
        
        if (x === 0) {
            percentageDOM.changeResult.textContent = 'Cannot calculate change from zero';
            return;
        }

        const change = ((y - x) / x) * 100;
        const prefix = change >= 0 ? 'Increase of ' : 'Decrease of ';
        const colorClass = change >= 0 ? 'delta-positive' : 'delta-negative';

        percentageDOM.changeResult.innerHTML = `<span class="${colorClass}">${prefix}${Math.abs(change).toLocaleString('en-US', { maximumFractionDigits: 2 })}%</span>`;
    }

    // --- Event Listeners for calculations ---
    [percentageDOM.percentOfX, percentageDOM.percentOfY].forEach(el => {
        el.addEventListener('input', calculatePercentOf);
    });

    [percentageDOM.isWhatX, percentageDOM.isWhatY].forEach(el => {
        el.addEventListener('input', calculateIsWhatPercent);
    });

    [percentageDOM.changeFromX, percentageDOM.changeToY].forEach(el => {
        el.addEventListener('input', calculatePercentChange);
    });
});