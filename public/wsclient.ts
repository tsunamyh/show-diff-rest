const HOST = location.href.replace(/^http/, "ws");
const ws = new WebSocket(HOST);

// DOM Elements
const loadingSpinner = document.getElementById('loading-spinner');
const contentDiv = document.getElementById('content');
const usdtRateDisplay = document.getElementById('usdt-rate');
const lastUpdateDisplay = document.getElementById('last-update');

interface RowsInfo {
  status?: string;
  maxDiff?: { exchangeName: string;  topFiveCurrencies: CurrencyDiffTracker[]; };
  size?: number;
//   forEach?: (callback: (rowInfo: RowInfo) => void) => void;
}

interface CurrencyDiffTracker {
    symbol: string;
    statusCompare: string;
    maxDifference: number;
    percentages: {
    time: string;
    value: number;
    }[];
}

ws.onopen = function () {
    console.log('WebSocket connected');
    showLoading(true);
};

ws.onmessage = function ({ data }) {
    // console.log("rowsInfo:>", data);
    try {
        const rowsInfo = JSON.parse(data);
        
        // اگر آرایه باشد (rowsInfo)
        if (Array.isArray(rowsInfo) && rowsInfo.length > 0) {
            printData(rowsInfo);
            showLoading(false);
        }
        // اگر object باشد (maxDiff, size, balance)
        else if (rowsInfo.status == "maxDiff") {
            printMaxDiff(rowsInfo);
        }
        else if (rowsInfo.status == "size") {
            printClientSize(rowsInfo.size);
        }
        // else if (rowsInfo.status == "balance") {
        //     printDataBal(rowsInfo.rowDataBal);
        // }
    } catch (error) {
        console.error('Error parsing WebSocket data:', error);
    }
};

ws.onclose = function () {
    console.log('WebSocket disconnected');
    showLoading(false);
};

ws.onerror = function (error) {
    console.error('WebSocket error:', error);
    showLoading(false);
};

function showLoading(isLoading) {
    if (loadingSpinner) {
        loadingSpinner.style.display = isLoading ? 'flex' : 'none';
    }
    if (contentDiv) {
        contentDiv.style.display = isLoading ? 'none' : 'block';
    }
}

function setTiltle(title) {
    const titleElement = document.querySelector("h4");
    if (titleElement) {
        titleElement.innerHTML = title;
    }
}

function updateUsdtRate(rate) {
    if (usdtRateDisplay) {
        usdtRateDisplay.textContent = rate.toLocaleString('fa-IR');
    }
}

function updateLastUpdate() {
    if (lastUpdateDisplay) {
        lastUpdateDisplay.textContent = new Date().toLocaleTimeString('fa-IR');
    }
}

function printMaxDiff(data: any) {
  if (data.status !== "maxDiff") return;

  const container = document.getElementById("max-diff-container");
  if (!container) return;

  const { exchangeName, topFiveCurrencies } = data.maxDiff;

  // id یکتا برای هر صرافی
  const tableId = `max-diff-${exchangeName}`;
  const tbodyId = `${tableId}-body`;

  let table = document.getElementById(tableId) as HTMLTableElement | null;

  // اگر جدول وجود ندارد، بساز
  if (!table) {
    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "40px";

    wrapper.innerHTML = `
      <h3>📊 بیشترین اختلاف قیمت - ${exchangeName}</h3>
      <table id="${tableId}">
        <thead>
          <tr class="headers">
            <th>نماد</th>
            <th>نوع مقایسه</th>
            <th>بیشترین اختلاف</th>
            <th>درصد</th>
            <th>زمان</th>
          </tr>
        </thead>
        <tbody id="${tbodyId}"></tbody>
      </table>
    `;

    container.appendChild(wrapper);
  }

  const tbody = document.getElementById(tbodyId) as HTMLTableSectionElement;
  if (!tbody) return;

  // فقط جدول همین صرافی آپدیت می‌شود
  tbody.innerHTML = "";

  topFiveCurrencies.forEach((item: any) => {
    const tr = document.createElement("tr");

    const compareText =
      item.statusCompare === "UsdtVsUsdt"
        ? "USDT ↔ USDT"
        : "USDT ↔ تومان";

    tr.innerHTML = `
      <td>${item.symbol}</td>
      <td>${compareText}</td>
      <td>${item.maxDifference}</td>
      <td>${item.percentages?.[0]?.value ?? "-"}</td>
      <td>${item.percentages?.[0]?.time ?? "-"}</td>
    `;

    tbody.appendChild(tr);
  });
}

// function createCurrencyTable(exchangeName, currencies, accentColor) {
//     const wrapper = document.createElement('div');
//     wrapper.style.cssText = `
//         background: white;
//         border-radius: 12px;
//         overflow: hidden;
//         box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
//     `;
    
//     // سرتیتر
//     const header = document.createElement('div');
//     header.style.cssText = `
//         background: ${accentColor};
//         color: white;
//         padding: 15px;
//         font-weight: bold;
//         font-size: 18px;
//         text-align: center;
//     `;
//     header.textContent = exchangeName;
//     wrapper.appendChild(header);
    
//     // جدول
//     const table = document.createElement('table');
//     table.style.cssText = `
//         width: 100%;
//         border-collapse: collapse;
//         font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//     `;
    
//     // سرستون‌ها
//     const thead = document.createElement('thead');
//     const headerRow = document.createElement('tr');
//     headerRow.style.cssText = `
//         background: #f8f9fa;
//         border-bottom: 2px solid ${accentColor};
//     `;
    
//     const th1 = document.createElement('th');
//     th1.textContent = 'ارز';
//     th1.style.cssText = 'padding: 12px; text-align: right; color: #333; font-weight: 600;';
    
//     const th2 = document.createElement('th');
//     th2.textContent = 'بیشترین تفاوت';
//     th2.style.cssText = 'padding: 12px; text-align: center; color: #333; font-weight: 600;';
    
//     const th3 = document.createElement('th');
//     th3.textContent = 'آخرین 5 درصد';
//     th3.style.cssText = 'padding: 12px; text-align: left; color: #333; font-weight: 600;';
    
//     headerRow.appendChild(th1);
//     headerRow.appendChild(th2);
//     headerRow.appendChild(th3);
//     thead.appendChild(headerRow);
//     table.appendChild(thead);
    
//     // بدنه جدول
//     const tbody = document.createElement('tbody');
    
//     currencies.forEach((currency, index) => {
//         const row = document.createElement('tr');
//         row.style.cssText = `
//             border-bottom: 1px solid #eee;
//             transition: background 0.3s ease;
//         `;
        
//         row.addEventListener('mouseover', () => {
//             row.style.background = '#f8f9fa';
//         });
//         row.addEventListener('mouseout', () => {
//             row.style.background = 'white';
//         });
        
//         // سمبل
//         const tdSymbol = document.createElement('td');
//         tdSymbol.textContent = currency.symbol;
//         tdSymbol.style.cssText = `
//             padding: 12px;
//             text-align: right;
//             font-weight: 600;
//             color: #333;
//         `;
        
//         // بیشترین تفاوت
//         const tdMaxDiff = document.createElement('td');
//         const maxDiffValue = currency.maxDifference.toFixed(2);
//         tdMaxDiff.innerHTML = `<span style="
//             background: ${accentColor};
//             color: white;
//             padding: 6px 12px;
//             border-radius: 20px;
//             font-weight: 600;
//             display: inline-block;
//         ">${maxDiffValue}%</span>`;
//         tdMaxDiff.style.cssText = `
//             padding: 12px;
//             text-align: center;
//         `;
        
//         // آخرین 5 درصد
//         const tdPercentages = document.createElement('td');
//         const percentagesHtml = (currency.percentages || [])
//             .slice(0, 5)
//             .map((p, i) => `
//                 <span style="
//                     display: inline-block;
//                     background: #e8f5e9;
//                     color: #2e7d32;
//                     padding: 4px 8px;
//                     border-radius: 4px;
//                     margin: 2px;
//                     font-size: 12px;
//                     font-weight: 500;
//                 ">${p.value.toFixed(2)}%</span>
//             `).join('');
//         tdPercentages.innerHTML = percentagesHtml || '-';
//         tdPercentages.style.cssText = `
//             padding: 12px;
//             text-align: left;
//         `;
        
//         row.appendChild(tdSymbol);
//         row.appendChild(tdMaxDiff);
//         row.appendChild(tdPercentages);
//         tbody.appendChild(row);
//     });
    
//     table.appendChild(tbody);
//     wrapper.appendChild(table);
    
//     return wrapper;
// }

function printClientSize(size) {
    const clientElement = document.getElementById('connection-status');
    if (clientElement) {
        clientElement.textContent = `تعداد افراد آنلاین: ${size}`;
    }
}

function printData(rowsInfo) {
    clearTable();
    
    if (!rowsInfo || rowsInfo.length === 0) {
        showEmptyState();
        return;
    }

    const tbody = document.getElementById('order');
    
    rowsInfo.forEach(function (rowInfo) {
        const statusbuy = rowInfo.statusbuy;
        const rowData = rowInfo.rowData;
        
        // Create table row
        const tr = document.createElement('tr');
        tr.className = 'data-row';
        
        // Symbol
        const tdSymbol = document.createElement('td');
        tdSymbol.textContent = rowData.symbol;
        tdSymbol.className = 'symbol-cell';
        tr.appendChild(tdSymbol);
        
        // Status Badge
        const tdStatus = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `status-badge status-${statusbuy.toLowerCase()}`;
        badge.textContent = statusbuy;
        tdStatus.appendChild(badge);
        tr.appendChild(tdStatus);
        
        // Wallex Price
        const tdWallexPrice = document.createElement('td');
        tdWallexPrice.textContent = formatPrice(rowData.wallex[0]);
        tr.appendChild(tdWallexPrice);
        
        // Binance Price
        const tdBinancePrice = document.createElement('td');
        tdBinancePrice.textContent = formatPrice(rowData.binance);
        tr.appendChild(tdBinancePrice);
        
        // Percent
        const tdPercent = document.createElement('td');
        tdPercent.textContent = rowData.percent.toFixed(2) + '%';
        tdPercent.className = rowData.percent > 0 ? 'percent-positive' : 'percent-negative';
        tr.appendChild(tdPercent);
        
        // Value
        const tdValue = document.createElement('td');
        tdValue.textContent = parseInt(rowData.value).toLocaleString('fa-IR');
        tr.appendChild(tdValue);
        
        // Description
        const tdDescription = document.createElement('td');
        tdDescription.textContent = rowData.description;
        tr.appendChild(tdDescription);
        
        tbody.appendChild(tr);
    });
    
    updateLastUpdate();
}

function formatPrice(price) {
    const num = parseFloat(price);
    return num.toLocaleString('fa-IR', { 
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    });
}

function showEmptyState() {
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.style.display = 'block';
    }
}

function hideEmptyState() {
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
}

// function printDataBal(rowDataBal) {
//     const tBody = document.querySelector("tbody#balance");
//     if (!tBody) return;
    
//     const tRow = document.createElement("tr");
//     tRow.setAttribute("class", "balRow");
//     tBody.appendChild(tRow);
//     Object.keys(rowDataBal).forEach(function (key) {
//         const tCell = document.createElement("td");
//         tRow.appendChild(tCell);
//         tCell.innerText = rowDataBal[key];
//     });
// }

function clearTable() {
    const tbody = document.getElementById('order');
    if (tbody) {
        tbody.innerHTML = '';
    }
    hideEmptyState();
}

function sortTable() {
    let table, rows, switching, i, x, y, shouldSwitch;
    table = document.getElementById("exchange");
    switching = true;
    while (switching) {
        switching = false;
        rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
        for (i = 0; i < rows.length - 1; i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("td")[4]; // percent column
            y = rows[i + 1].getElementsByTagName("td")[4];
            if (x && y && +x.innerHTML < +y.innerHTML) {
                shouldSwitch = true;
                break;
            }
        }
        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
        }
    }
}
