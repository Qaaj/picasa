import http from "http";
import { Server as SocketIOServer } from "socket.io";

export function initSockets(app) {
  const server = http.createServer(app.callback());
  const io = new SocketIOServer(server);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socket.emit("hello", { msg: "Socket connection OK" });
  });

  // make io available via ctx.io
  app.context.io = io;

  return server;
}
