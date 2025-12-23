const HOST = location.href.replace(/^http/, "ws");
const ws = new WebSocket(HOST);

// DOM Elements
const loadingSpinner = document.getElementById('loading-spinner');
const contentDiv = document.getElementById('content');
const usdtRateDisplay = document.getElementById('usdt-rate');
const lastUpdateDisplay = document.getElementById('last-update');

interface RowsInfo {
  status?: string;
  maxDiff?: { symbol: string; percent: string }[];
  size?: number;
//   forEach?: (callback: (rowInfo: RowInfo) => void) => void;
}

ws.onopen = function () {
    console.log('WebSocket connected');
    showLoading(true);
};

ws.onmessage = function ({ data }) {
    console.log("rowsInfo:>", data);
    try {
        const rowsInfo = JSON.parse(data);
        
        // اگر آرایه باشد (rowsInfo)
        if (Array.isArray(rowsInfo) && rowsInfo.length > 0) {
            printData(rowsInfo);
            showLoading(false);
        }
        // اگر object باشد (maxDiff, size, balance)
        else if (rowsInfo.status == "maxDiff") {
            printMaxDiff(rowsInfo.maxDiff);
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

function printMaxDiff(maxDiff) {

}

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
