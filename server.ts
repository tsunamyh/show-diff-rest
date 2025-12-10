import { WebSocketServer, WebSocket } from "ws";
import http, { IncomingMessage, Server, ServerResponse } from "http";
import { app } from "./app";
import { eventEmmiter } from "./components/price_comparison";

const server: Server = http.createServer(app);

const wss: WebSocketServer = new WebSocketServer({
  noServer: true,
  path: "/diff",
  clientTracking: false,
});

const clients: Set<WebSocket> = new Set();

function diffListener(rowsInfo: string): void {
  clients.forEach(function (client: WebSocket) {
    client.send(rowsInfo);
  });
}

// let getOrderInterval;

server.on("upgrade", function (req: IncomingMessage, socket: any, head: Buffer) {
  // if (clients.size === 0) {
  //   getOrderInterval = intervalFunc(); // This function will be executed once
  // }
  wss.handleUpgrade(req, socket, head, async function (ws: WebSocket) {
    clients.add(ws);
    const clientSize = { size: clients.size };
    diffListener(JSON.stringify(clientSize));
    console.log("clients:", clientSize);
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async function connection(ws: WebSocket, req: IncomingMessage) {
  eventEmmiter.on("diff", diffListener);

  ws.on("close", () => {
    clients.delete(ws);
    eventEmmiter.removeListener("diff", diffListener);
    console.log("clients.size:", clients.size);
    // if (clients.size === 0) {
    //   clearInterval(getOrderInterval);
    // }

    console.log("Client disconnected");
  });

  ws.on("error", function () {
    console.log("Some Error occurred");
  });
});

export { server };