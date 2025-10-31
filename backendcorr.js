// --- Backend Correlations Logic ---
        let shopifyScorecardChart, metaScorecardChart, googleScorecardChart;

        function parseShopifyCsv(csvText) {
            const rows = csvText.split('\n').filter(row => row.trim() !== '');
            if (rows.length < 2) throw new Error("Shopify CSV is empty or has no data rows.");
        
            const header = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const dayIndex = header.indexOf('Day');
            
            // Look for "Orders" first, then fall back to "Total orders"
            let ordersIndex = header.indexOf('Orders');
            if (ordersIndex === -1) {
                ordersIndex = header.indexOf('Total orders');
            }
        
            if (dayIndex === -1 || ordersIndex === -1) {
                throw new Error("Shopify CSV must contain 'Day' and either 'Orders' or 'Total orders' columns.");
            }
            
            const dailyOrders = {};
            rows.slice(1).forEach(row => {
                const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // handle commas inside quotes if any
                if (values.length > Math.max(dayIndex, ordersIndex)) {
                    const day = values[dayIndex].trim().replace(/"/g, '');
                    if (day) {
                        const date = new Date(day);
                        if (!isNaN(date)) {
                            const formattedDate = date.toISOString().split('T')[0];
                            if (!dailyOrders[formattedDate]) {
                                dailyOrders[formattedDate] = 0;
                            }
                            dailyOrders[formattedDate] += parseInt(values[ordersIndex].trim().replace(/"/g, ''), 10) || 0;
                        }
                    }
                }
            });
        
            return Object.entries(dailyOrders).map(([day, orders]) => ({ Day: day, Orders: orders }));
        }

        function parseAdPlatformCsv(csvText) {
            const rows = csvText.split('\n').filter(row => row.trim() !== '');
            if (rows.length < 2) throw new Error("CSV file has no data rows.");
        
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
                'CTR': ['CTR (link click-through rate)', 'CTR', 'CTR (all)'],
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
                     const firstDataRow = rows[1].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                     if (firstDataRow[index] && !isNaN(parseFloat(firstDataRow[index].trim().replace(/"/g, '').replace(/[^0-9.-]/g, '')))) {
                        headerMapping[index] = col;
                     }
                }
            });
        
            if (dayIndex === -1) {
                throw new Error("CSV must contain a 'Day' or 'Date' column.");
            }
        
            const data = rows.slice(1).map(row => {
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
                    const numValue = parseFloat(rawValue.replace(/[^0-9.]/g, ''));
                    if (!isNaN(numValue)) {
                        rowData[metricName] = numValue;
                    }
                }
                return rowData;
            }).filter(Boolean);
        
            if (data.length === 0) throw new Error("No valid data could be parsed from the CSV.");
        
            return data;
        }
        
        function aggregateDataByMonth(data, valueKey) {
            const monthlyData = {};
            data.forEach(row => {
                if (typeof row.Day !== 'string') {
                    console.warn('Invalid data format found in row:', row);
                    return; 
                }
                const month = row.Day.substring(0, 7); // 'YYYY-MM'
                if (!monthlyData[month]) {
                    monthlyData[month] = 0;
                }
                monthlyData[month] += row[valueKey] || 0;
            });
    
            const sortedMonths = Object.keys(monthlyData).sort();
            const labels = sortedMonths.map(month => {
                const date = new Date(month + '-02'); // Use day 2 to avoid timezone issues
                return date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            });
            const values = sortedMonths.map(month => monthlyData[month]);
            
            return { labels, values };
        }

        function renderBackendScorecards() {
            if (shopifyScorecardChart) shopifyScorecardChart.destroy();
            if (metaScorecardChart) metaScorecardChart.destroy();
            if (googleScorecardChart) googleScorecardChart.destroy();

            const scorecardContainer = document.getElementById('backend-correlations-scorecards');
            const shopifyScorecard = document.getElementById('shopify-scorecard');
            const metaScorecard = document.getElementById('meta-scorecard');
            const googleScorecard = document.getElementById('google-scorecard');
        
            let hasData = false;
            
            const themeColors = getThemeColors();
            const scorecardChartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { display: false }, y: { display: false } },
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                elements: { point: { radius: 0 }, line: { tension: 0.4 } },
                layout: { padding: { top: 5, bottom: 0 } }
            };

            const renderScorecardChart = (canvasId, data, valueKey, chartInstanceVar) => {
                const { labels, values } = aggregateDataByMonth(data, valueKey);
                if (labels.length < 2) return null;

                const ctx = document.getElementById(canvasId).getContext('2d');
                const gradient = ctx.createLinearGradient(0, 0, 0, 80);
                gradient.addColorStop(0, themeColors.primaryRgba);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                return new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            borderColor: themeColors.primary,
                            backgroundColor: gradient,
                            fill: true,
                            borderWidth: 2
                        }]
                    },
                    options: scorecardChartOptions
                });
            };
        
            // Shopify
            if (shopifyData.length > 0) {
                const totalOrders = shopifyData.reduce((sum, row) => sum + (row.Orders || 0), 0);
                const avgOrders = totalOrders / shopifyData.length;
        
                document.getElementById('shopify-total-orders').textContent = totalOrders.toLocaleString('en-US');
                document.getElementById('shopify-avg-orders').textContent = avgOrders.toFixed(1);
                shopifyScorecard.classList.remove('hidden');
                shopifyScorecardChart = renderScorecardChart('shopify-scorecard-chart', shopifyData, 'Orders');
                hasData = true;
            } else {
                shopifyScorecard.classList.add('hidden');
            }
        
            // Meta
            if (metaCorrelationsData.length > 0) {
                const totalTransactions = metaCorrelationsData.reduce((sum, row) => sum + (row.Transactions || 0), 0);
                const avgTransactions = totalTransactions / metaCorrelationsData.length;
        
                document.getElementById('meta-total-transactions').textContent = totalTransactions.toLocaleString('en-US');
                document.getElementById('meta-avg-transactions').textContent = avgTransactions.toFixed(1);
                metaScorecard.classList.remove('hidden');
                metaScorecardChart = renderScorecardChart('meta-scorecard-chart', metaCorrelationsData, 'Transactions');
                hasData = true;
            } else {
                metaScorecard.classList.add('hidden');
            }
        
            // Google
            if (googleCorrelationsData.length > 0) {
                const totalTransactions = googleCorrelationsData.reduce((sum, row) => sum + (row.Transactions || 0), 0);
                const avgTransactions = totalTransactions / googleCorrelationsData.length;
        
                document.getElementById('google-total-transactions').textContent = totalTransactions.toLocaleString('en-US');
                document.getElementById('google-avg-transactions').textContent = avgTransactions.toFixed(1);
                googleScorecard.classList.remove('hidden');
                googleScorecardChart = renderScorecardChart('google-scorecard-chart', googleCorrelationsData, 'Transactions');
                hasData = true;
            } else {
                googleScorecard.classList.add('hidden');
            }
        
            if (hasData) {
                scorecardContainer.classList.remove('hidden');
            } else {
                scorecardContainer.classList.add('hidden');
            }
        }

        function tryRenderBackendCorrelations() {
            renderBackendScorecards();

            if (shopifyData.length > 0 && (metaCorrelationsData.length > 0 || googleCorrelationsData.length > 0)) {
                alignBackendData();
                DOM.backendCorrelations.resultsContainer.classList.remove('hidden');
                DOM.backendCorrelations.filtersContainer.classList.remove('hidden');
                processAndRenderBackendCorrelations();
            }
        }

        function alignBackendData() {
            const adDataMap = new Map();
            const adMetricKeys = new Set();
        
            // Process Meta data
            metaCorrelationsData.forEach(row => {
                const day = row.Day;
                if (!adDataMap.has(day)) adDataMap.set(day, { Day: day });
                const entry = adDataMap.get(day);
                for (const metric in row) {
                    if (metric !== 'Day') {
                        adMetricKeys.add(metric);
                        entry[`Meta ${metric}`] = row[metric];
                    }
                }
            });
        
            // Process Google data
            googleCorrelationsData.forEach(row => {
                const day = row.Day;
                if (!adDataMap.has(day)) adDataMap.set(day, { Day: day });
                const entry = adDataMap.get(day);
                for (const metric in row) {
                    if (metric !== 'Day') {
                        adMetricKeys.add(metric);
                        entry[`Google ${metric}`] = row[metric];
                    }
                }
            });
        
            const shopifyDataMap = new Map(shopifyData.map(d => [d.Day, d]));
            const allDays = new Set([...adDataMap.keys(), ...shopifyDataMap.keys()]);
            const sortedDays = Array.from(allDays).sort();
        
            unfilteredAlignedBackendData = sortedDays.map(day => {
                const adMetrics = adDataMap.get(day) || {};
                const shopifyMetrics = shopifyDataMap.get(day) || {};
                
                // Create blended metrics
                const blendedMetrics = {};
                adMetricKeys.forEach(metric => {
                    blendedMetrics[metric] = (adMetrics[`Meta ${metric}`] || 0) + (adMetrics[`Google ${metric}`] || 0);
                });
        
                return {
                    Day: day,
                    Orders: shopifyMetrics.Orders || 0,
                    ...adMetrics, // Contains prefixed metrics
                    ...blendedMetrics // Contains non-prefixed, summed metrics
                };
            });
        }

        function populateBackendPeriodSelectors() {
            const container = DOM.backendCorrelations.periodSelectContainer;
            container.innerHTML = '';
            if (backendCorrelationPeriodType === 'all' || unfilteredAlignedBackendData.length === 0) {
                return;
            }

            const allDates = unfilteredAlignedBackendData.map(d => new Date(d.Day + 'T00:00:00')); // Ensure UTC parsing
            let optionsSet;
            let labelText;

            if (backendCorrelationPeriodType === 'monthly') {
                labelText = 'Select Month';
                optionsSet = new Set(allDates.map(d => d.toISOString().slice(0, 7))); // YYYY-MM
            } else if (backendCorrelationPeriodType === 'quarterly') {
                labelText = 'Select Quarter';
                optionsSet = new Set(allDates.map(d => `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`));
            } else if (backendCorrelationPeriodType === 'yearly') {
                labelText = 'Select Year';
                optionsSet = new Set(allDates.map(d => d.getUTCFullYear()));
            }

            if (!optionsSet || optionsSet.size === 0) return;

            const sortedOptions = Array.from(optionsSet).sort().reverse();
            
            let selectHTML = `<label for="backend-period-select" class="block text-sm font-medium text-gray-600">${labelText}:</label>
                              <select id="backend-period-select" class="styled-select mt-1 block w-full rounded-full p-2 max-w-xs">`;
            
            sortedOptions.forEach(optionValue => {
                let optionText = optionValue;
                if (backendCorrelationPeriodType === 'monthly') {
                    const [year, month] = optionValue.split('-');
                    optionText = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                } else if (backendCorrelationPeriodType === 'yearly') {
                    optionText = optionValue.toString();
                }
                selectHTML += `<option value="${optionValue}">${optionText}</option>`;
            });
            selectHTML += `</select>`;
            container.innerHTML = selectHTML;

            container.querySelector('#backend-period-select').addEventListener('change', processAndRenderBackendCorrelations);
        }

        function applyBackendFilter() {
            if (backendCorrelationPeriodType === 'all') {
                alignedBackendData = [...unfilteredAlignedBackendData];
                return;
            }

            const periodSelect = document.getElementById('backend-period-select');
            if (!periodSelect) {
                alignedBackendData = [...unfilteredAlignedBackendData];
                return;
            }
            const selectedValue = periodSelect.value;

            if (backendCorrelationPeriodType === 'monthly') {
                alignedBackendData = unfilteredAlignedBackendData.filter(d => d.Day.startsWith(selectedValue));
            } else if (backendCorrelationPeriodType === 'yearly') {
                alignedBackendData = unfilteredAlignedBackendData.filter(d => d.Day.startsWith(selectedValue));
            } else if (backendCorrelationPeriodType === 'quarterly') {
                const [year, quarter] = selectedValue.split('-Q');
                const yearNum = parseInt(year);
                const quarterNum = parseInt(quarter);
                const startMonth = (quarterNum - 1) * 3; // 0-indexed
                const endMonth = startMonth + 2;
                alignedBackendData = unfilteredAlignedBackendData.filter(d => {
                    const date = new Date(d.Day + 'T00:00:00');
                    return date.getUTCFullYear() === yearNum && date.getUTCMonth() >= startMonth && date.getUTCMonth() <= endMonth;
                });
            } else {
                alignedBackendData = [...unfilteredAlignedBackendData];
            }
        }

        function processAndRenderBackendCorrelations() {
            populateBackendPeriodSelectors();
            applyBackendFilter();

            if (alignedBackendData.length === 0) {
                DOM.backendCorrelations.correlationValue.textContent = 'N/A';
                DOM.backendCorrelations.correlationMarker.style.left = '50%';
                if (backendCorrelationOrdersChart) backendCorrelationOrdersChart.destroy();
                if (backendCorrelationMetricChart) backendCorrelationMetricChart.destroy();
                DOM.backendCorrelations.metricSelect.innerHTML = '';
                DOM.backendCorrelations.tableContainer.innerHTML = `<p class="text-center text-gray-500 py-8">No data available for the selected period.</p>`;
                return;
            }
            
            const adMetrics = Object.keys(alignedBackendData[0]).filter(k => k !== 'Day' && k !== 'Orders' && !k.startsWith('Meta ') && !k.startsWith('Google ') && typeof alignedBackendData[0][k] === 'number');
            
            const select = DOM.backendCorrelations.metricSelect;
            const currentVal = select.value;
            select.innerHTML = '';
            adMetrics.forEach(metric => {
                const option = document.createElement('option');
                option.value = metric;
                option.textContent = metric;
                select.appendChild(option);
            });
            
            if(adMetrics.includes(currentVal)) {
                select.value = currentVal;
            } else if (adMetrics.includes('Spend')) {
                select.value = 'Spend';
            } else if (adMetrics.length > 0) {
                select.value = adMetrics[0];
            }
            
            renderBackendCorrelationTable();
            renderBackendCorrelationCharts();
        }

        function renderBackendCorrelationTable() {
            const ordersData = alignedBackendData.map(d => d.Orders);
            const adMetrics = Object.keys(alignedBackendData[0]).filter(k => k !== 'Day' && k !== 'Orders' && typeof alignedBackendData[0][k] === 'number');

            const correlations = adMetrics.map(metric => {
                const metricData = alignedBackendData.map(d => d[metric] || 0);
                const correlation = correl(ordersData, metricData);
                return { metric, correlation: isNaN(correlation) ? 0 : correlation };
            }).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

            let tableHTML = `
                <h4 class="text-lg font-semibold text-gray-900 mb-4 mt-8">Correlation Summary</h4>
                <div class="overflow-x-auto">
                    <table class="analyzer-table text-sm">
                        <thead>
                            <tr>
                                <th>Ad Platform Metric</th>
                                <th>Correlation with Orders</th>
                            </tr>
                        </thead>
                        <tbody>`;

            correlations.forEach(({ metric, correlation }) => {
                tableHTML += `
                    <tr>
                        <td class="font-semibold">${metric}</td>
                        <td class="font-mono ${correlation > 0.5 ? 'text-green-600' : correlation < -0.5 ? 'text-red-600' : ''}">${correlation.toFixed(4)}</td>
                    </tr>`;
            });

            tableHTML += '</tbody></table></div>';
            DOM.backendCorrelations.tableContainer.innerHTML = tableHTML;
        }

        function renderBackendCorrelationCharts() {
            if (alignedBackendData.length === 0) return;
        
            const selectedMetric = DOM.backendCorrelations.metricSelect.value;
            if (!selectedMetric) return;
        
            // Helper to calculate and render a correlation value
            const renderCorrelation = (valueEl, markerEl, containerEl, correlation) => {
                if (containerEl) containerEl.classList.remove('hidden');
                valueEl.textContent = isNaN(correlation) ? 'N/A' : correlation.toFixed(4);
                const markerPosition = isNaN(correlation) ? 50 : (correlation + 1) / 2 * 100;
                const markerOffset = markerEl.offsetWidth / 2;
                markerEl.style.left = `calc(${markerPosition}% - ${markerOffset}px)`;
            };
        
            // 1. Overall Correlation (uses all data)
            const overallOrdersData = alignedBackendData.map(d => d.Orders);
            const overallMetricData = alignedBackendData.map(d => d[selectedMetric] || 0);
            const overallCorrelation = correl(overallOrdersData, overallMetricData);
            renderCorrelation(DOM.backendCorrelations.correlationValue, DOM.backendCorrelations.correlationMarker, null, overallCorrelation);
        
            // 2. Meta Correlation (uses only days with Meta data)
            if (metaCorrelationsData.length > 0 && alignedBackendData.some(d => d.hasOwnProperty(`Meta ${selectedMetric}`))) {
                const metaSpecificData = alignedBackendData.filter(d => d.hasOwnProperty(`Meta ${selectedMetric}`));
                const metaOrdersData = metaSpecificData.map(d => d.Orders);
                const metaMetricData = metaSpecificData.map(d => d[`Meta ${selectedMetric}`] || 0);
                const metaCorrelation = correl(metaOrdersData, metaMetricData);
                renderCorrelation(DOM.backendCorrelations.metaCorrelationValue, DOM.backendCorrelations.metaCorrelationMarker, DOM.backendCorrelations.metaCorrelationContainer, metaCorrelation);
            } else {
                DOM.backendCorrelations.metaCorrelationContainer.classList.add('hidden');
            }
        
            // 3. Google Correlation (uses only days with Google data)
            if (googleCorrelationsData.length > 0 && alignedBackendData.some(d => d.hasOwnProperty(`Google ${selectedMetric}`))) {
                const googleSpecificData = alignedBackendData.filter(d => d.hasOwnProperty(`Google ${selectedMetric}`));
                const googleOrdersData = googleSpecificData.map(d => d.Orders);
                const googleMetricData = googleSpecificData.map(d => d[`Google ${selectedMetric}`] || 0);
                const googleCorrelation = correl(googleOrdersData, googleMetricData);
                renderCorrelation(DOM.backendCorrelations.googleCorrelationValue, DOM.backendCorrelations.googleCorrelationMarker, DOM.backendCorrelations.googleCorrelationContainer, googleCorrelation);
            } else {
                DOM.backendCorrelations.googleCorrelationContainer.classList.add('hidden');
            }
        
            // --- Chart Rendering (uses overall data, which is correct for the main charts) ---
            const labels = alignedBackendData.map(d => formatDate(d.Day));
            const themeColors = getThemeColors();
            const options = (title) => ({
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: themeColors.ticks, autoSkip: true, maxTicksLimit: 15 }, grid: { color: themeColors.grid } },
                    y: { ticks: { color: themeColors.ticks }, grid: { color: themeColors.grid }, title: {display: true, text: title, color: themeColors.ticks} }
                },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: title, color: themeColors.title, font: { size: 16 } }
                }
            });
            
            if (backendCorrelationOrdersChart) backendCorrelationOrdersChart.destroy();
            backendCorrelationOrdersChart = new Chart(DOM.backendCorrelations.ordersChartCanvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{ data: overallOrdersData, borderColor: themeColors.primary, backgroundColor: themeColors.primaryRgba, fill: true, tension: 0.4 }]
                },
                options: options('Shopify Orders')
            });
        
            if (backendCorrelationMetricChart) backendCorrelationMetricChart.destroy();
            backendCorrelationMetricChart = new Chart(DOM.backendCorrelations.metricChartCanvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{ data: overallMetricData, borderColor: themeColors.secondary, backgroundColor: themeColors.secondaryRgba, fill: true, tension: 0.4 }]
                },
                options: options(selectedMetric)
            });
        }