// Preloaded into the web server (node --import) in the container.
//
// Node gives up on any request that takes longer than 5 minutes to arrive,
// and `next start` has no setting for it. A long video sent over mobile data
// can take longer than that, so allow UPLOAD_TIMEOUT_MINUTES (default 60).

import http from "node:http";

const minutes = Number(process.env.UPLOAD_TIMEOUT_MINUTES || 60);
const createServer = http.createServer;

http.createServer = function (...args) {
  const server = createServer.apply(this, args);
  if (minutes > 0) server.requestTimeout = minutes * 60_000;
  return server;
};
