/**
 * IUB Data Fetcher controller.
 */
const Client = require('ftp');
var fs = require('fs');

/**
 * Include configuration
 */
const { IUB } = require('../config');

/**
 * Extracts a specific .tar.gz file and saves the files to the database.
 * @param {Object} fileName - File which needs to be extracted.
 */
function extractIUBFileData(fileName) {

}

/**
 * Downloads a specific file from the IUB Database.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server.
 * @param {Object} fileToFetch - Object of the current file that needs to be fetched.
 */
function downloadIUBData(ftpClient, fileToFetch) {
  // Get file stream from IUB FTP server
  ftpClient.get(fileToFetch.name, (err, stream) => {
    if (err) throw err;

    // When ZIP file is saved, make sure to extract and save data
    stream.once('close', () => extractIUBFileData(fileToFetch.name));

    // Save the file to local system
    stream.pipe(fs.createWriteStream(fileToFetch.name));
  });
}

/**
 * Reads IUB FTP structure.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server. 
 */
function readIUBFtpStructure(ftpClient) {
  // List all initial files/directories of IUB FTP
  ftpClient.list((err, rootList) => {
    if (err) throw err;

    // Retrieve current directory
    ftpClient.pwd((err, currentDir) => {
      if (err) throw err;

      // Filter only year directories and exclude any files.
      // TODO: Later, when DB is hooked up, we can filter directories that have not yet been added to our db
      const fetchYearDirectory = rootList.filter(item => item.type === 'd')[0];

      // Navigate inside the year directory
      ftpClient.cwd(`${currentDir}/${fetchYearDirectory.name}`, err => {
        if (err) throw err;

        // List files in the year directory
        ftpClient.list((err, monthList) => {
          if (err) throw err;

          // Filter out only month directories and exclude any files
          // TODO: Later, when DB is hooked up, we can filter directories that have not yet been added to our db
          const fetchMonthDirectory = monthList.filter(item => item.type === 'd')[0];

          // Navigate inside the month directory
          ftpClient.cwd(`${currentDir}/${fetchYearDirectory.name}/${fetchMonthDirectory.name}`, err => {
            if (err) throw err;

            // List the files in month directory
            ftpClient.list((err, fileList) => {
              if (err) throw err;

              // Filter out only tar.gz files
              // TODO: Later, when DB is hooked up, we can filter ZIP files that have not yet been added to our db
              const fileToFetch = fileList.filter(item => item.name.indexOf('.tar.gz') !== -1)[0];

              // Download the file and extract the data
              downloadIUBData(ftpClient, fileToFetch);
            });
          });
        });
      });

      // TODO: Add promise to end only after everything has fetched
      ftpClient.end();
    });
  });
}

module.exports = {
  fetchIUBData() {
    // Initialize ftp client
    const ftpClient = new Client();

    // Retrieve directory list
    ftpClient.on('ready', () => readIUBFtpStructure(ftpClient));

    // Connect to the IUB FTP
    ftpClient.connect({
      host: IUB.ftpHostname
    });
  }
};
