
const COMMAND_LINE_ARGS = require("command-line-args");
const FS=require("fs");
const PATH=require("path");
const READLINE=require("readline");


const commandLineOptions = COMMAND_LINE_ARGS([
    {
        name: "path",
        defaultOption: true,
        type: String,
    },
]);

let filesPath = commandLineOptions.path || ".";
if (!PATH.isAbsolute(filesPath)) {
  filesPath = PATH.normalize(PATH.join(__dirname, filesPath));
}





const copyFromDirectoryInto=function(sourceDirectory,targetDirectory){
    //target directory should be existing already at this point
    const sourcePaths=FS.readdirSync(sourceDirectory);
    for(const path of sourcePaths){
        const sourcePath=PATH.join(sourceDirectory,path);
        const targetPath=PATH.join(targetDirectory,path);
        if(FS.statSync(sourcePath).isDirectory()){
            FS.mkdirSync(targetPath);
            copyFromDirectoryInto(sourcePath,targetPath);
        }
        else{
            const readStream=FS.createReadStream(sourcePath);
            const writeStream=FS.createWriteStream(targetPath);
            readStream.pipe(writeStream);
        }
    }
}

const cleanUpDirectory=function(directory){
    //target directory should be existing already at this point
    const files=FS.readdirSync(directory);
    for(const path of files){
        const filePath=PATH.join(directory,path);
        if(FS.statSync(filePath).isDirectory()){
            cleanUpDirectory(filePath);
            FS.rmdirSync(filePath);
        }
        else{
            FS.unlinkSync(filePath);
        }
    }
}


const readlineInterface=READLINE.createInterface({
    input:process.stdin,
    output:process.stdout,
});


const clientAppPath=PATH.join(__dirname,"client_app");

readlineInterface.question(`##### You are about to remove whatever is in [${clientAppPath}] and recursively copy in files from [${filesPath}]. Press enter to confirm this otherwise terminate the program`,()=>{
    readlineInterface.close();
    //......
    cleanUpDirectory(clientAppPath);
    copyFromDirectoryInto(commandLineOptions.path,clientAppPath);
});