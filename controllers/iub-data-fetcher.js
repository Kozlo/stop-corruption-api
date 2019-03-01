/**
 * IUB Data Fetcher controller.
 */
const ftpClientInstance = require('ftp');
const fs = require('fs');
const fse = require('fs-extra');
const targz = require('targz');
const xmlParser = require('xml-js');
const IubEntry = require('../models/iubEntry');

/**
 * Include configuration
 */
const { IUB } = require('../config');

/**
 * Parses XML file to JSON string.
 *
 * If an entry already exists based on the ID then update it, otherwise create a new one.
 *
 * @param {string} xmlPath - Path to the XML file which needs to be parsed to JSON.
 */
function parseIUBXmlToJson(xmlPath) {
  return new Promise((resolve, reject) => {
    // Read the file
    fs.readFile(xmlPath, 'utf8', (err, data) => {
      if (err) reject(err);

      // Parse XML to JSON
      const parsedFileContent = JSON.parse(xmlParser.xml2json(data, { compact: true, spaces: 4 }));
      const documentId = parsedFileContent.document.id._text;

      // TODO: Save parsed file content to the database.
      IubEntry.findOne({ document_id: documentId })
        .then(entry => {
          if (entry) {
            return IubEntry.findByIdAndUpdate(entry._id, {
              document_id: documentId,
              general: {
                name: parsedFileContent.document.general.name._text,
              },
            }, { 'new': true, runValidators: true });

          } else {
            return IubEntry.create({
              document_id: documentId,
              general: {
                name: parsedFileContent.document.general.name._text,
              },
            });
          }
        })
        .then(() => resolve(true))
        .catch(err => {
          console.error(err);
          reject(err);
        });
    });
  });
}

/**
 * Extracts a specific .tar.gz file and saves the files to the database.
 * @param {Object} filePath - Path to the file which needs to be extracted.
 */
function extractIUBFileData(filePath) {
  // Remove directory and extension for file name, so we can save it in a specific directory
  const fileName = filePath.replace(`${IUB.IUBLocalDataDirectory}/`, '').replace('.tar.gz', '');

  // Decompress IUB .tar.gz files to our server
  targz.decompress({
    src: filePath,
    dest: `${IUB.IUBLocalDataDirectory}/${fileName}`
  }, err => {
    if (err) throw err;

    // If there are no errors, we have successfully decompressed the files
    // First let's delete the .tar.gz file
    fs.unlinkSync(filePath);

    // Now let's read files in the extracted directory
    fs.readdir(`${IUB.IUBLocalDataDirectory}/${fileName}`, (err, files) => {
      if (err) throw err;

      // Create promise array for the file parsing
      const IUBFileParsingPromises = [];

      // Go through each of the files
      files.forEach(file => {
        // Add each file to promise
        IUBFileParsingPromises.push(parseIUBXmlToJson(`${IUB.IUBLocalDataDirectory}/${fileName}/${file}`));
      });

      // Wait for all files are parsed
      Promise.all(IUBFileParsingPromises).then(() => {
        // After all files are parsed, make sure that we delete directory with files
        fse.remove(`${IUB.IUBLocalDataDirectory}/${fileName}`, err => {
          if (err) throw err;
        });
      })
      .catch(err => {
        throw err
      });
    });
  });
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
    stream.once('close', () => {
      // TODO: Save last fetched file in the database

      // Extract IUB File
      extractIUBFileData(`${IUB.IUBLocalDataDirectory}/${fileToFetch.name}`);
    });

    // Save the file to local system
    stream.pipe(fs.createWriteStream(`${IUB.IUBLocalDataDirectory}/${fileToFetch.name}`));
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

/**
 * Modules that are exported from the controller.
 */
module.exports = {
  /**
   * Fetches data from the IUB data.
   */
  fetchIUBData() {
    // Initialize ftp client
    const ftpClient = new ftpClientInstance();

    // Retrieve directory list
    ftpClient.on('ready', () => readIUBFtpStructure(ftpClient));

    // Connect to the IUB FTP
    ftpClient.connect({
      host: IUB.ftpHostname
    });
  }
};
