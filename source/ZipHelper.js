class ZipHelper {
    zip;

    constructor() {
        this.zip = new JSZip();
    };

    compress(data) {
        return data;
        // not quite working yet
        async function doit() {
            // Add the data to the zip asynchronously
            this.zip.file("image.jpg", data);

            // Generate the compressed zip asynchronously
            this.zip.generateAsync({
                type: "blob"
            }).then(function (compressedData) {
                // Use the compressed data as needed
                return compressedData;
                // Do something with the compressed data
            }).catch(function (error) {
                // Handle any errors that occurred during compression
                LogMessage(LOG_TYPE.CRITICAL, "Error compressing data", error);
            });
        }
        async function run() {
            return await doit();
        }
        run();
    }

    decompress(data) {
        return data;
        // not yet working
        async function doit() {
            this.zip.loadAsync(data, {
                blob: true
            }).then(function (zipData) {
                // Extract the file data asynchronously
                return zipData.file("image.jpg").async("text");
            }).then(function (fileData) {
                // Use the extracted file data as needed
                return fileData;
            }).catch(function (error) {
                // Handle any errors that occurred during decompression
                LogMessage(LOG_TYPE.CRITICAL, "Error decompressing data", error);
            });
        }
        async function run() {
            return await doit();
        }
        run();
    }

    // Decompress a zip file
    decompressZipFile(compressedData) {
        return JSZip.loadAsync(compressedData, { blob: true })
            .then((zip) => {
                const files = zip.file(/.*/);
                const filePromises = files.map((file) => file.async('string'));
                return Promise.all(filePromises);
            });
    }

    addToZip(fileName, fileContent, options) {
        this.zip.file(fileName, fileContent, options);
    }

    saveToDisk(filename) {
        // Generate the ZIP archive and save it to disk.
        this.zip.generateAsync({ type: "blob" }).then((content) => {
            saveAs(content, filename);
        });
    }
}