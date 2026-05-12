// Adds `rawBody` to Node's IncomingMessage so the JSON body-parser `verify`
// callback can stash the raw payload for WhatsApp webhook signature checks.
// Express' `Request` extends `http.IncomingMessage`, so it inherits this too.
declare module 'http' {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

export {};
