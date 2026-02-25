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
  // forEach?: (callback: (rowInfo: RowInfo) => void) => void;
  RowInfo?: RowInfo[];
}

interface RowInfo {
  exchangeName: string;
  statusbuy: string;
  rowData: CurrencyDiffTracker;
}
enum PeriodType {
  last1h = 'last1h',
  last24h = 'last24h',
  lastWeek = 'lastWeek',
  allTime = 'allTime'
}
interface CurrencyDiffTracker {
  id?: number;
  exchange_name: string;
  symbol: string;
  status_compare: string;
  period_type?: PeriodType;
  difference: number;
  exchange_ask_tmn: string; // exchange_buy_price?: number;
  exchange_ask_usdt?: string;
  exchange_quantity_tmn: string;  //buy_volume_tmn?: number;
  exchange_quantity_usdt?: string;  //buy_volume_tmn?: number;
  binance_ask_tmn: string;
  binance_ask_usdt?: string;
  my_percent: string;
  spread: string;  //askBidDifferencePercentInevery exchange
  last_updated?: string;
  description?: string;
  exchange_quantity_currency?: string;
}

interface maxDiffPeriod {
    exchangeName: "wallex" | "nobitex" | "okex";
    last1h: CurrencyDiffTracker[];
    last24h: CurrencyDiffTracker[];
    lastWeek: CurrencyDiffTracker[];
    allTime: CurrencyDiffTracker[];
}

interface HistoryFile {
  exchangeName: string;
  last1h: CurrencyDiffTracker[];
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

// function updateUsdtRate(rate) {
//   if (usdtRateDisplay) {
//     usdtRateDisplay.textContent = rate.toLocaleString('fa-IR');
//   }
// }

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

  let exchangeSection = document.getElementById(`exchange-${historyFile.exchangeName}`);

  if (!exchangeSection) {
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

    exchangeSection = document.createElement("div");
    exchangeSection.id = `exchange-${historyFile.exchangeName}`;
    exchangeSection.style.cssText = `
      margin-bottom: 30px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      border-right: 4px solid #667eea;
    `;

    const exchangeHeader = document.createElement("h2");
    exchangeHeader.style.cssText = `
      margin: 0 0 15px 0;
      color: #667eea;
      font-size: 20px;
    `;
    exchangeHeader.textContent = `${historyFile.exchangeName}`;
    exchangeSection.appendChild(exchangeHeader);

    container.appendChild(exchangeSection);
  }

  // بررسی اینکه آیا تب‌ها قبلا ایجاد شده‌اند
  let tabsContainer = exchangeSection.querySelector(`[data-tabs-container="${historyFile.exchangeName}"]`) as HTMLElement | null;
  let contentContainer = exchangeSection.querySelector(`[data-content-container="${historyFile.exchangeName}"]`) as HTMLElement | null;

  if (!tabsContainer || !contentContainer) {
    // پاک کردن محتوای قدیمی (جز عنوان)
    const children = Array.from(exchangeSection.children);
    children.slice(1).forEach(child => child.remove());

    // ایجاد تب‌ها برای انتخاب دوره
    tabsContainer = document.createElement("div");
    tabsContainer.setAttribute("data-tabs-container", historyFile.exchangeName);
    tabsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid #ddd;
      flex-wrap: wrap;
    `;

    const periods = [
      { key: 'last1h', label: '📊 ساعت گذشته', data: historyFile.last1h },
      { key: 'last24h', label: '📊 24 ساعت گذشته', data: historyFile.last24h },
      { key: 'lastWeek', label: '📈 هفته گذشته', data: historyFile.lastWeek },
      { key: 'allTime', label: '📉 کل دوره', data: historyFile.allTime }
    ];

    contentContainer = document.createElement("div");
    contentContainer.setAttribute("data-content-container", historyFile.exchangeName);

    // متغیر برای ذخیره تب فعلی
    let activeTabKey = 'last1h';

    periods.forEach((period, index) => {
      const tab = document.createElement("button");
      const isActive = index === 0;

      tab.setAttribute("data-tab-key", period.key);
      tab.textContent = period.label;
      tab.style.cssText = `
        padding: 10px 15px;
        border: none;
        background: ${isActive ? '#667eea' : '#e8e8e8'};
        color: ${isActive ? 'white' : '#333'};
        border-radius: 4px 4px 0 0;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s ease;
        font-size: 14px;
      `;

      tab.addEventListener('mouseover', () => {
        if (tab.getAttribute("data-tab-key") !== activeTabKey) {
          tab.style.background = '#d0d0d0';
        }
      });

      tab.addEventListener('mouseout', () => {
        if (tab.getAttribute("data-tab-key") !== activeTabKey) {
          tab.style.background = '#e8e8e8';
        }
      });

      tab.addEventListener('click', () => {
        activeTabKey = period.key;

        // حذف محتوای قبلی
        contentContainer!.innerHTML = '';

        // آپدیت استایل تب‌ها
        Array.from(tabsContainer!.querySelectorAll('button')).forEach(btn => {
          btn.style.background = '#e8e8e8';
          btn.style.color = '#333';
        });
        tab.style.background = '#667eea';
        tab.style.color = 'white';

        // نمایش جدول انتخاب‌شده
        createPeriodTable(contentContainer!, period.label, period.data, true);
      });

      tabsContainer!.appendChild(tab);

      // نمایش جدول اول (24 ساعت گذشته) به صورت پیشفرض
      if (isActive) {
        createPeriodTable(contentContainer, period.label, period.data, true);
      }
    });

    exchangeSection.appendChild(tabsContainer);
    exchangeSection.appendChild(contentContainer);
  } else {
    // اگر تب‌ها قبلا وجود دارند، فقط داده‌ها را آپدیت کن
    const periods = [
      { key: 'last1h', label: '📊 ساعت گذشته', data: historyFile.last1h },
      { key: 'last24h', label: '📊 24 ساعت گذشته', data: historyFile.last24h },
      { key: 'lastWeek', label: '📈 هفته گذشته', data: historyFile.lastWeek },
      { key: 'allTime', label: '📉 کل دوره', data: historyFile.allTime }
    ];

    // یافتن تب فعلی
    const activeTab = tabsContainer.querySelector('button[style*="#667eea"]') as HTMLElement | null;
    const activeTabKey = activeTab?.getAttribute("data-tab-key") || 'last1h';

    // آپدیت محتوا برای تب فعلی
    const activePeriod = periods.find(p => p.key === activeTabKey);
    if (activePeriod) {
      contentContainer.innerHTML = '';
      createPeriodTable(contentContainer, activePeriod.label, activePeriod.data, true);
    }
  }

  updateLastUpdate();
}

function createPeriodTable(container: HTMLElement, title: string, currencies: CurrencyDiffTracker[], isTabContent: boolean = false) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    margin-bottom: 30px;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  `;

  // عنوان دوره (فقط اگر از تب نباشد)
  if (!isTabContent) {
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
  }

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
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">صرافی</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">نوع</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">قیمت خرید (TMN)</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">قیمت فروش (TMN)</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">حجم</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">درصد</th>
      <th style="padding: 12px; text-align: center; color: #333; font-weight: 600;">زمان</th>
    </tr>
  `;
  table.appendChild(thead);

  // بدنه جدول
  const tbody = document.createElement("tbody");

  if (!currencies || currencies.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="8" style="padding: 15px; text-align: center; color: #999;">داده‌ای موجود نیست</td>`;
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

      const symbol = item.symbol ?? "-";
      const exchangeName = item.exchange_name ?? "-";
      const statusCompare = item.status_compare ?? "-";
      const exchangePrice = item.exchange_ask_tmn ? formatPrice(item.exchange_ask_tmn) : "-";
      const binancePrice = item.binance_ask_tmn ? formatPrice(item.binance_ask_tmn) : "-";
      const volume = item.exchange_quantity_tmn ? parseInt(item.exchange_quantity_tmn).toLocaleString('fa-IR') : "-";
      const percent = item.difference ?? "-";
      const latestTime = item.last_updated 
        ? (new Date(item.last_updated)).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" }) 
        : "-";

      tr.innerHTML = `
        <td style="padding: 12px; text-align: right; font-weight: 600; color: #333;">${symbol}</td>
        <td style="padding: 12px; text-align: center; font-weight: 500; color: #667eea;">${exchangeName}</td>
        <td style="padding: 12px; text-align: center; font-size: 12px; color: #666;">${statusCompare}</td>
        <td style="padding: 12px; text-align: center; color: #27ae60; font-weight: 500;">${exchangePrice}</td>
        <td style="padding: 12px; text-align: center; color: #e74c3c; font-weight: 500;">${binancePrice}</td>
        <td style="padding: 12px; text-align: center; color: #666;">${volume}</td>
        <td style="padding: 12px; text-align: center;">
          <span style="background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
            ${typeof percent === 'number' ? percent.toFixed(2) + '%' : percent}
          </span>
        </td>
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

function printData(rowsInfo : RowInfo[]) {
  clearTable();

  if (!rowsInfo || rowsInfo.length === 0) {
    showEmptyState();
    return;
  }

  const tbody = document.getElementById('order');

  rowsInfo.forEach(function (rowInfo) {
    const statusbuy = rowInfo.statusbuy;
    const rowData = rowInfo.rowData;
    const exchangeName = rowInfo.exchangeName;

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

    // Exchange Name
    const tdExchangeName = document.createElement('td');
    tdExchangeName.textContent = exchangeName;
    tdExchangeName.style.fontWeight = '600';
    tdExchangeName.style.color = '#667eea';
    tr.appendChild(tdExchangeName);

    // Get exchange price (wallex or okex)
    const exchangePrice = rowData.exchange_ask_tmn || "0";
    
    // Buy Price (خرید)
    const tdBuyPrice = document.createElement('td');
    tdBuyPrice.textContent = formatPrice(exchangePrice);
    tdBuyPrice.style.color = '#27ae60';
    tdBuyPrice.style.fontWeight = '500';
    tr.appendChild(tdBuyPrice);

    // Sell Price (فروش)
    const tdSellPrice = document.createElement('td');
    tdSellPrice.textContent = formatPrice(rowData.binance_ask_tmn || "0");
    tdSellPrice.style.color = '#e74c3c';
    tdSellPrice.style.fontWeight = '500';
    tr.appendChild(tdSellPrice);

    // Percent
    const tdPercent = document.createElement('td');
    tdPercent.textContent = rowData.difference + '%';
    tdPercent.className = rowData.difference > 0 ? 'percent-positive' : 'percent-negative';
    tr.appendChild(tdPercent);

    // Value
    const tdValue = document.createElement('td');
    tdValue.textContent = parseInt(rowData.exchange_quantity_tmn).toLocaleString('fa-IR');
    tr.appendChild(tdValue);

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
