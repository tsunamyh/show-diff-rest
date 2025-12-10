const HOST = location.href.replace(/^http/, "ws");
const ws = new WebSocket(HOST);
ws.onopen = function () {
    setTiltle("connected");
};
ws.onmessage = function ({ data }) {
    console.log("rowsInfo:>", data);
    const rowsInfo = JSON.parse(data);
    if (rowsInfo.status == "maxDiff") {
        printMaxDiff(rowsInfo.maxDiff);
    }
    else if (rowsInfo.size) {
        printClientSize(rowsInfo.size);
    }
    else if (rowsInfo.status == "balance") {
        printDataBal(rowsInfo.rowDataBal);
    }
    else {
        printData(rowsInfo);
    }
};
ws.onclose = function () {
    setTiltle("disconnected");
};
function setTiltle(title) {
    document.querySelector("h4").innerHTML = title;
}
function printMaxDiff(maxDiff) {
    let text = "";
    text = maxDiff[0].symbol + ":=> " + maxDiff[0].percent + " :" + " بهترین درصد ";
    let diffMax = document.querySelector("h3");
    diffMax.innerText = text;
    console.log("maxdiff;", maxDiff);
}
function printClientSize(size) {
    document.querySelector("h5").innerHTML = "تعداد افراد آنلاین : " + size;
}
function printData(rowsInfo) {
    clearTable();
    rowsInfo.forEach(function (rowInfo) {
        const statusbuy = rowInfo.statusbuy;
        const rowData = rowInfo.rowData;
        const tBody = document.querySelector("tbody#order");
        const tRow = document.createElement("tr");
        tRow.setAttribute("class", "row");
        tBody.appendChild(tRow);
        Object.keys(rowData).forEach(function (key) {
            const tCell = document.createElement("td");
            tRow.appendChild(tCell);
            tCell.innerText = rowData[key];
            if (statusbuy == key) {
                tCell.style.backgroundColor = "#8fff4e";
            }
        });
    });
    sortTable();
}
function printDataBal(rowDataBal) {
    const tBody = document.querySelector("tbody#balance");
    const tRow = document.createElement("tr");
    tRow.setAttribute("class", "balRow");
    tBody.appendChild(tRow);
    Object.keys(rowDataBal).forEach(function (key) {
        const tCell = document.createElement("td");
        tRow.appendChild(tCell);
        tCell.innerText = rowDataBal[key];
    });
}
function clearTable() {
    const trows = document.querySelectorAll(".row");
    trows.forEach(function (tRow) {
        tRow.remove();
    });
}
function sortTable() {
    let table, rows, switching, i, x, y, shouldSwitch;
    table = document.getElementById("exchange");
    switching = true;
    while (switching) {
        switching = false;
        rows = table.rows;
        for (i = 1; i < rows.length - 1; i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("td")[1];
            y = rows[i + 1].getElementsByTagName("td")[1];
            if (+x.innerHTML < +y.innerHTML) {
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
