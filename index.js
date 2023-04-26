console.clear();

const HTTP = require('http');
const MULTER = require('multer');
const FS = require("fs");
const PATH = require("path");
const COMMAND_LINE_ARGS = require("command-line-args");
const WEBSOCKET = require("websocket");
const CHOKIDAR = require("chokidar");

const commandLineOptions = COMMAND_LINE_ARGS([
  {
    name: "path",
    defaultOption: true,
    type: String,
  },
  {
    name: "port",
    alias: "p",
    type: Number,
  },
]);




let filesPath = commandLineOptions.path || "_files";
if (!PATH.isAbsolute(filesPath)) {
  filesPath = PATH.normalize(PATH.join(__dirname, filesPath));
}

console.log(`Watching files :: ${filesPath}`);

const multerDiskStorageEngine = MULTER.diskStorage({
  destination: function (requestObj, file, callback) {
    if (!FS.existsSync(filesPath)) {
      try {
        FS.mkdirSync(filesPath);
      }
      catch (e) {
        callback(e, filesPath);
      }
      return;
    }
    callback(null, filesPath);
  },
  filename: function (requestObj, file, callback) {
    const error = null;
    // const error=FS.existsSync(PATH.join(filesPath,file.originalname))? "FILE-ALREADY-EXISTS":null;
    callback(error, file.originalname);
  },
});

const multer = MULTER({
  storage: multerDiskStorageEngine,
});

const server = HTTP.createServer(function (requestObj, responder) {

  // console.log(`~~~~~~~~${requestObj.url}~~~~~~~~~`);

  responder.setHeader("Access-Control-Allow-Origin", "*");
  responder.setHeader("Access-Control-Allow-Methods", "OPTIONS");

  if (requestObj.method == "OPTIONS") {
    responder.end();
    return;
  }


  const url = new URL(requestObj.url, "x://x.x/");
  //to remove trailing "/" from url pathname
  while (url.pathname.endsWith("/")) {
    url.pathname = url.pathname.substr(0, url.pathname.length - 1);
  }

  //to set default visit
  if (url.pathname == "") {
    url.pathname = "/app";
  }


  //we shall determine the service this request wants to access using the first term in its pathname
  let pathnameParts = url.pathname.split("/");

  const serviceSelector = pathnameParts[1];
  const servicePath = pathnameParts.splice(2).join("/"); //this doesn't have a leading or trailing "/"

  if (serviceSelector == "app") {
    const targetPath = __dirname + "/client_app/" + (servicePath !== "" ? servicePath : "index.html"); //do not normalize this path so that the client doesn't get to manipulate our file system.
    if (targetPath.endsWith(".js")) {
      responder.setHeader("Content-Type", "application/javascript");
    }
    // console.log(targetPath);
    try {
      const read = FS.readFileSync(targetPath);
      responder.end(read);
    }
    catch (e) {
      // console.log(url.pathname);
      console.log(e);
      responder.statusCode=404;
      responder.end();
    }
    return;
  }

  if (serviceSelector == "navigate-folder") {
    const targetPath = filesPath + servicePath; //do not normalize this path so that the client doesn't get to manipulate our file system.
    try {
      if (!FS.existsSync(targetPath)) {
        throw new Response400Error("PATH-DOESNT-EXIST");
      }
      if (!FS.lstatSync(targetPath).isDirectory()) {
        throw new Response400Error("PATH-NOT-DIRECTORY");
      }
      const result = {};
      FS.readdirSync(targetPath).forEach(function (x) {
        const lstat = FS.lstatSync(PATH.join(targetPath, x));
        result[x] = {
          isDirectory: lstat.isDirectory(),
        }
      });
      responder.end(JSON.stringify(result));
    }
    catch (e) {
      // console.log(e);
      if (e instanceof Response400Error) {
        responder.statusCode = 400;
        responder.end(e.getCode());
      }
      else {
        responder.statusCode = 500;
        responder.end();
      }
    }
    return;
  }








  if (requestObj.url === '/upload' && requestObj.method === 'POST') {
    multer.single('file')(requestObj, responder, function (e) {
      if (e) {
        console.error(e);
        responder.writeHead(500, { 'Content-Type': 'text/plain' });
        responder.end('Error uploading file!');
        return;
      }
      console.log(`UPLOADED: ${requestObj.file.path}`);
      responder.writeHead(200, { 'Content-Type': 'text/plain' });
      responder.end('File uploaded successfully!');
    });
    return;
  }


  responder.writeHead(404, { 'Content-Type': 'text/plain' });
  responder.end('Not Found');
});

server.listen(80, () => {
  console.log(`Server started on port ${server.address().port}`);
});


const serverWebsocketServer = new WEBSOCKET.server({
  httpServer: server,
  autoAcceptConnections: false,
});

serverWebsocketServer.on("request", function (requestObj) {
  const connection = requestObj.accept(null, requestObj.origin);
  // console.log("NEW CONNECTION");
});

const watcher = CHOKIDAR.watch(filesPath);
watcher.on("all", function (eventId, path) {
  // console.log(eventId,path);
  for (const connection of serverWebsocketServer.connections) {
    connection.send(JSON.stringify({
      eventId,
      path:PATH.relative(filesPath,path),
    }));
  }
});


const Response400Error = function (code) {
  this.getCode = function () {
    return code;
  }
}