const HOST = location.href.replace(/^http/, "ws");
const ws = new WebSocket(HOST);

// DOM Elements
const loadingSpinner = document.getElementById('loading-spinner');
const contentDiv = document.getElementById('content');
const usdtRateDisplay = document.getElementById('usdt-rate');
const lastUpdateDisplay = document.getElementById('last-update');

interface RowsInfo {
  status?: string;
  maxDiff?: HistoryFile;
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
    exchangeBuyPrice?: number;
    binanceSellPrice?: number;
    buyVolume?: number;
  }[];
}

interface HistoryFile {
  timestamp: string;
  exchangeName: string;
  last24h: CurrencyDiffTracker[];
  lastWeek: CurrencyDiffTracker[];
  allTime: CurrencyDiffTracker[];
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

function printMaxDiff(data: RowsInfo) {
  if (data.status !== "maxDiff" || !data.maxDiff) return;

  const container = document.getElementById("max-diff-container");
  if (!container) return;

  const historyFile: HistoryFile = data.maxDiff;

  // بررسی اینکه آیا قبلا container این صرافی ایجاد شده است
  let exchangeSection = document.getElementById(`exchange-${historyFile.exchangeName}`);
  
  if (!exchangeSection) {
    // اگر اول بار است، ابتدا header کل را اضافه کن (فقط یک بار)
    if (container.children.length === 0) {
      const mainHeader = document.createElement("div");
      mainHeader.style.cssText = `
        padding: 15px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
      `;
      mainHeader.innerHTML = `<h2>📊 تحلیل تفاوت قیمت صرافی‌ها</h2>`;
      container.appendChild(mainHeader);
    }

    // ایجاد section برای این صرافی
    exchangeSection = document.createElement("div");
    exchangeSection.id = `exchange-${historyFile.exchangeName}`;
    exchangeSection.style.cssText = `
      margin-bottom: 30px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      border-right: 4px solid #667eea;
    `;

    // عنوان صرافی
    const exchangeHeader = document.createElement("h2");
    exchangeHeader.style.cssText = `
      margin: 0 0 15px 0;
      color: #667eea;
      font-size: 20px;
    `;
    exchangeHeader.textContent = `${historyFile.exchangeName}`;
    exchangeSection.appendChild(exchangeHeader);

    container.appendChild(exchangeSection);
  } else {
    // اگر قبلا ایجاد شده، محتوای قبلی را پاک کن (جز عنوان)
    const children = Array.from(exchangeSection.children);
    children.slice(1).forEach(child => child.remove());
  }

  // نمایش سه دوره زمانی
  const periods = [
    { key: 'last24h', label: '📊 آخرین 24 ساعت', data: historyFile.last24h },
    { key: 'lastWeek', label: '📈 آخرین هفته', data: historyFile.lastWeek },
    { key: 'allTime', label: '📉 کل دوره', data: historyFile.allTime }
  ];

  periods.forEach(period => {
    createPeriodTable(exchangeSection, period.label, period.data);
  });

  updateLastUpdate();
}

function createPeriodTable(container: HTMLElement, title: string, currencies: CurrencyDiffTracker[]) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    margin-bottom: 30px;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  `;

  // عنوان دوره
  const periodTitle = document.createElement("h3");
  periodTitle.style.cssText = `
    margin: 0;
    padding: 15px;
    background: #f8f9fa;
    color: #333;
    border-bottom: 2px solid #667eea;
  `;
  periodTitle.textContent = title;
  wrapper.appendChild(periodTitle);

  // جدول
  const table = document.createElement("table");
  table.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  `;

  // سرستون‌ها
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr style="background: #f8f9fa; border-bottom: 1px solid #ddd;">
      <th style="padding: 12px; text-align: right; color: #333; font-weight: 600;">نماد</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">نوع مقایسه</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">بیشترین اختلاف</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">درصد</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">زمان</th>
    </tr>
  `;
  table.appendChild(thead);

  // بدنه جدول
  const tbody = document.createElement("tbody");

  if (!currencies || currencies.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="5" style="padding: 15px; text-align: center; color: #999;">داده‌ای موجود نیست</td>`;
    tbody.appendChild(emptyRow);
  } else {
    currencies.forEach((item: CurrencyDiffTracker, index: number) => {
      const tr = document.createElement("tr");
      tr.style.cssText = `
        border-bottom: 1px solid #eee;
        transition: background 0.3s ease;
      `;

      tr.addEventListener('mouseover', () => {
        tr.style.background = '#f8f9fa';
      });
      tr.addEventListener('mouseout', () => {
        tr.style.background = 'white';
      });

      const compareText = item.statusCompare === "UsdtVsUsdt" ? "USDT ↔ USDT" : "USDT ↔ تومان";
      const latestPercent = item.percentages?.[0]?.value ?? "-";
      const latestTime = item.percentages?.[0]?.time ?? "-";

      tr.innerHTML = `
        <td style="padding: 12px; text-align: right; font-weight: 600; color: #333;">${item.symbol}</td>
        <td style="padding: 12px; text-align: center; color: #666;">${compareText}</td>
        <td style="padding: 12px; text-align: center;">
          <span style="background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
            ${item.maxDifference.toFixed(2)}%
          </span>
        </td>
        <td style="padding: 12px; text-align: center; color: #666;">${typeof latestPercent === 'number' ? latestPercent.toFixed(2) + '%' : latestPercent}</td>
        <td style="padding: 12px; text-align: center; color: #999; font-size: 12px;">${latestTime}</td>
      `;

      tbody.appendChild(tr);
    });
  }

  table.appendChild(tbody);
  wrapper.appendChild(table);
  container.appendChild(wrapper);
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
