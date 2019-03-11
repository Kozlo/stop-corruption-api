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
 * Include configuration and helpers
 */
const { IUB } = require('../config');
const helpers = require('../helpers');

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
      let parsedData;

      try {
        parsedData = JSON.parse(xmlParser.xml2json(data, { compact: true, spaces: 4 }));
      } catch (e) {
        console.error(e);
        return resolve(true);
      }

      let {
        id, // PVS dokumenta ID
        authority_name = {}, // Iestādes nosaukums
        authority_reg_num = {}, // Iestādes reģistrācijas Nr.
        general = {}, // { // Vispārējie paziņojuma parametri
          // main_cpv = {}, // Datu bloks satur iepirkuma galveno CPV kodu
        // } = {},
        part_5_list: { // Līguma slēgšanas tiesību piešķiršana
          part_5: { // Saraksts var saturēt vienu vai vairākas paziņojuma par iepirkuma procedūras rezultātiem V daļas (paziņojuma par līguma slēgšanas tiesību piešķiršanu IV daļas) datu struktūras „part_5
            decision_date = {}, // Lēmuma pieņemšanas datums / Līguma slēgšanas datums
            contract_price_exact = {}, // Kopējā līgumcena
            exact_currency = {}, // Kopējā līgumcena – valūta.
            tender_num = {}, // Saņemto piedāvājumu skaits.
            contract_name = {}, // Iepirkuma nosaukums
            creation_date_stamp = {}, // "Attiecīgā datuma unix timestamp vērtība" - tehniskās dokumentācijas
          } = {},
        } = {},
        main_cpv = {},
        part_2 = {},
        winner_list,
        eu_fund,
        additional_info: {
          approval_date = {},
          approval_date_stamp = {},
          update_date = {},
          update_date_stamp = {},
        } = {},
        publication_date = {},
        publication_date_stamp = {},
      } = parsedData.document;

      if (!id || !id._text) {
        return resolve(true);
      }


      if (!winner_list || !winner_list.winner) {
        if (
          parsedData.document.part_5_list &&
          parsedData.document.part_5_list.part_5 &&
          parsedData.document.part_5_list.part_5.winner_list &&
          parsedData.document.part_5_list.part_5.winner_list.winner
        ) {
          winner_list = {
            winner: parsedData.document.part_5_list.part_5.winner_list.winner
          };
        } else {
          console.log('no winner');
          return resolve(true);
        }
      }

      const { winner } = winner_list;

      IubEntry.findOneAndUpdate(
        { document_id: id._text },
        {
          document_id: id._text,
          authority_name: authority_name ? authority_name._text : null,
          authority_reg_num: authority_reg_num ? authority_reg_num._text: null,
          // main_cpv:  {
          //   lv: 'aaa',
          //   en: main_cpv.en || null,
          //   code_num: main_cpv.code_num || null,
          //   name: main_cpv.name || null,
          //   authority_name: main_cpv.authority_name || null,
          // },
          general: {
            // main_cpv: general.main_cpv ? {
              // lv: general.main_cpv.lv ? general.main_cpv.lv._text : null,
              // en: main_cpv.en ? main_cpv.en._text : null,
              // code_num: main_cpv.code_num ? main_cpv.code_num._text : null,
              // name: main_cpv.name ? main_cpv.name._text : null,
              // authority_name: main_cpv.authority_name ? main_cpv.authority_name._text : null,
              // contract_price_exact: main_cpv.contract_price_exact ? main_cpv.contract_price_exact._text : null,
              // approval_date: main_cpv.approval_date ? main_cpv.approval_date._text : null,
            // } : {},
          },
          part_5_list: {
            part_5: {
              decision_date: decision_date ? decision_date._text : null,
              contract_price_exact: contract_price_exact && !isNaN(parseFloat(contract_price_exact._text)) ? parseFloat(contract_price_exact._text) : null,
              exact_currency: exact_currency ? exact_currency._text : null,
              tender_num: tender_num ? tender_num._text : null,
              contract_name: contract_name ? contract_name._text : null,
              creation_date_stamp: creation_date_stamp ? creation_date_stamp._text : null,
            }
          },
          part_2: {
            price_exact: part_2.price_exact && !isNaN(parseFloat(part_2.price_exact._text)) ? parseFloat(part_2.price_exact._text) : null,
            price_exact_eur: part_2.price_exact_eur && !isNaN(parseFloat(part_2.price_exact_eur._text)) ? parseFloat(part_2.price_exact_eur._text) : null,
          },
          additional_info: {
            approval_date: approval_date ? approval_date._text : null,
            approval_date_stamp: approval_date_stamp ? approval_date_stamp._text : null,
            update_date: update_date ? update_date._text : null,
            update_date_stamp: update_date_stamp ? update_date_stamp._text : null,

          },
          winner_list: {
            winner: {
              winner_name: winner.winner_name ? winner.winner_name._text : null,
              winner_reg_num: winner.winner_reg_num ? winner.winner_reg_num._text : null,
              winner_country: winner.winner_country ? winner.winner_country._text : null,
              price_exact_eur: winner.price_exact_eur && !isNaN(parseFloat(winner.price_exact_eur._text)) ? parseFloat(winner.price_exact_eur._text) : null,
              approval_date: winner.approval_date ? winner.approval_date._text : null,
              publication_date: winner.publication_date ? winner.publication_date._text : null,
            },
          },
          eu_fund: eu_fund === '0' ? false : eu_fund === '1' ? true : undefined,
          publication_date: publication_date ? publication_date._text : null,
          publication_date_stamp: publication_date_stamp ? publication_date_stamp._text : null,
        },
        {
          upsert: true, // insert if not found
        }
      )
      .then(() => resolve(true))
      .catch(err => {
        console.log(err);
        reject(err);
      });
    });
  });
}

/**
 * Extracts a specific .tar.gz file and saves the files to the database.
 * @param {Object} filePath - Path to the file which needs to be extracted.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server.
 * @param {string} year Year string (e.g. '2014')
 * @param {string} month Month string (e.g. '01')
 * @param {string} day Date string (e.g. '31')
 */
function extractIUBFileData(filePath, ftpClient, year, month, day) {
  // Remove directory and extension for file name, so we can save it in a specific directory
  const fileName = filePath.replace(`${IUB.IUBLocalDataDirectory}/`, '').replace('.tar.gz', '');
  const fileDirectoryPath = `${IUB.IUBLocalDataDirectory}/${fileName}`;

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
    fs.readdir(fileDirectoryPath, (err, files) => {
      if (err) throw err;

      // Create promise array for the file parsing
      const IUBFileParsingPromises = [];

      // Go through each of the files
      files.forEach(file => {
        // Add each file to promise
        IUBFileParsingPromises.push(parseIUBXmlToJson(`${fileDirectoryPath}/${file}`));
      });

      // Wait for all files are parsed
      return Promise.all(IUBFileParsingPromises)
        .then(() => {
          // After all files are parsed, make sure that we delete directory with files
          fse.remove(`${IUB.IUBLocalDataDirectory}/${fileName}`, err => {
            if (err) throw err;

            return callNextIteration(ftpClient, year, month, day);
          });
        })
        .catch(err => {
          throw err
        });
    });
  });
}

function callNextIteration(ftpClient, year, month, day) {
  const fetchedDate = new Date();

  fetchedDate.setFullYear(year);
  fetchedDate.setMonth(parseInt(month) - 1);
  fetchedDate.setDate(day);

  if (helpers.isToday(fetchedDate)) {
    // Close FTP connection

    return ftpClient.end();
  } else {
    const nextDay = new Date();

    nextDay.setFullYear(year);
    nextDay.setMonth(parseInt(month) - 1);
    nextDay.setDate(fetchedDate.getDate() + 1);

    const nextDayMonth = nextDay.getMonth() + 1;
    const nextDayDate = nextDay.getDate();
    const nextDayParsedDate = nextDayDate < 10 ? `0${nextDayDate}` : nextDayDate.toString();
    const nextDayParsedMonth = nextDayMonth < 10 ? `0${nextDayMonth}` : nextDayMonth.toString();
    const nextDayYear = nextDay.getFullYear().toString();

    ftpClient.end();

    return fetchIUBData(nextDayYear, nextDayParsedMonth, nextDayParsedDate);
  }
}
/**
 * Downloads a specific file from the IUB Database.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server.
 * @param {Object} fileToFetch - Object of the current file that needs to be fetched.
 * @param {string} year Year string (e.g. '2014')
 * @param {string} month Month string (e.g. '01')
 * @param {string} day Date string (e.g. '31')
 */
function downloadIUBData(ftpClient, fileToFetch, year, month, day) {
  // Get file stream from IUB FTP server
  ftpClient.get(fileToFetch.name, (err, stream) => {
    if (err) throw err;

    // When ZIP file is saved, make sure to extract and save data
    stream.once('close', () => {
      // Close FTP connection
      ftpClient.end();

      // Extract IUB File
      extractIUBFileData(`${IUB.IUBLocalDataDirectory}/${fileToFetch.name}`, ftpClient, year, month, day);
    });

    // Save the file to local system
    stream.pipe(fs.createWriteStream(`${IUB.IUBLocalDataDirectory}/${fileToFetch.name}`));
  });
}

/**
 * Reads IUB FTP structure.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server.
 * @param {string} year Year string (e.g. '2014')
 * @param {string} month Month string (e.g. '01')
 * @param {string} day Date string (e.g. '31')
 */
function readIUBFtpStructure(ftpClient, year, month, day) {
  // List all initial files/directories of IUB FTP
  ftpClient.list((err, rootList) => {
    if (err) throw err;

    // Find the year directories and exclude any files.
    const directoryTypeName = 'd';
    const fetchYearDirectoryName = rootList.find(item => item.type === directoryTypeName && item.name === year).name;

    // Retrieve current directory
    ftpClient.pwd((err, currentDir) => {
      if (err) throw err;

      const yearDirectoryPath = `${currentDir}/${fetchYearDirectoryName}`;

      // Navigate inside the year directory
      ftpClient.cwd(yearDirectoryPath, err => {
        if (err) throw err;

        // List files in the year directory
        ftpClient.list((err, monthList) => {
          if (err) throw err;

          // Filter out only month directories and exclude any files
          const fetchMonthDirectoryName = monthList.find(item => item.type === 'd' && item.name == `${month}_${year}`).name;
          const monthDirectoryName = `${currentDir}/${fetchYearDirectoryName}/${fetchMonthDirectoryName}`;

          // Navigate inside the month directory
          ftpClient.cwd(monthDirectoryName, err => {
            if (err) throw err;

            // List the files in month directory
            ftpClient.list((err, fileList) => {
              if (err) throw err;

              // Filter out only tar.gz files
              let fileToFetch = fileList.find(item => item.name.indexOf('.tar.gz') !== -1 && item.name === `${day}_${month}_${year}.tar.gz`);

              if (fileToFetch) {
                // Download the file and extract the data
                downloadIUBData(ftpClient, fileToFetch, year, month, day);
              } else {
                callNextIteration(ftpClient, year, month, day);
              }
            });
          });
        });
      });
    });
  });
}

/**
 * Initializes a new FTP client instance and initiates fetching on ready.
 *
 * @param {string} year Year string (e.g. '2014')
 * @param {string} month Month string (e.g. '01')
 * @param {string} day Date string (e.g. '31')
 */
function fetchIUBData(year, month, day) {
  // Initialize ftp client
  const ftpClient = new ftpClientInstance();

  // Retrieve directory list
  ftpClient.on('ready', () => {
    console.log(`Fetching: ${year}/${month}/${day}`);
    readIUBFtpStructure(ftpClient, year, month, day);
  });

  // Connect to the IUB FTP
  ftpClient.connect({
    host: IUB.ftpHostname
  });
}

/**
 * Modules that are exported from the controller.
 */
module.exports = {
  /**
   * Fetches data from the IUB data.
   */
  fetchIUBData
};
