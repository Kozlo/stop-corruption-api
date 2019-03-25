/**
 * IUB Data Fetcher controller.
 */
const ftpClientInstance = require('ftp');
const fs = require('fs');
const fse = require('fs-extra');
const targz = require('targz');
const xmlParser = require('xml-js');
const IubEntry = require('../models/iubEntry');

const config = require('../config');

/**
 * Include configuration and helpers
 */
const { httpStatusCodes, monthStrings, dayStrings, IUB } = config;
const helpers = require('../helpers');

const allowedTypes = [
  'notice_concluded_contract', // Informatīvs paziņojums par noslēgto līgumu
  'notice_contract_rights', // Paziņojums par līguma slēgšanas tiesību piešķiršanu
  'notice_exante', // Brīvprātīgs paziņojums par iepirkuma rezultātiem
  'notice_soc_results', // Paziņojums par sociālajiem un citiem īpašiem paklapojumiem - paziņojums par līguma slēgšanas tiesību piešķiršanu
  'notice_contract_rights_sps', // Paziņojums par līguma slēgšanas tiesību piešķiršanu - sabiedriskie pakalpojumi
  'sps_notice_exante', // Brīvprātīgs paziņojums par iepirkuma rezultātiem - sabiedriskie pakalpojumi
  'sps_soc_results', // Paziņojums par sociālajiem un citiem īpašiem paklapojumiem - paziņojums par līguma slēgšanas tiesību piešķiršanu (sabiedriskie pakalpojumi)
  'notice_contract_rights_81', // Paziņojums par iepirkuma procedūras rezultātiem aizsardzības un drošības jomā
  'notice_exante_81', // Brīvprātīgs paziņojums par iepirkuma rezultātiem aizsardzības un drošības jomā
  'notice_concession_results', // Paziņojums par koncesijas piešķiršanu
  'notice_concession_exante', // Brīvprātīgs paziņojums par koncesijas procedūras rezultātiem
  'concession_soc_results', // Paziņojums par koncesijas piešķiršanu sociālajiem un citiem īpašiem pakalpojumiem
  'notice_299_results', // Paziņojums par finansējuma saņēmēja iepirkuma procedūras rezultātiem
];

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
      let document;

      try {
        document = JSON.parse(xmlParser.xml2json(data, { compact: true, spaces: 4 })).document;
      } catch (e) {
        // console.error(e);
        return resolve(true);
      }

      let parsedPrice, parsedWinners = [];
      let {
        id, // PVS dokumenta ID
        type, // Dokumenta tips (paziņojums,lēmums utt.)
        authority_name, // Iestādes nosaukums
        authority_reg_num, // Iestādes reģistrācijas Nr.
        eu_fund, // vai iepirkums saistīts ar ES fondu piesaisti
        currency,
        exact_currency,
        contract_currency,
        decision_date,
        price,
        price_exact_lvl,
        contract_price_exact,
        contract_price_exact_lvl,
        contract_price_from,
        contract_price_to,
        general = {}, // { // Vispārējie paziņojuma parametri
        part_5_list: { // Līguma slēgšanas tiesību piešķiršana
          part_5 = {},
        } = {},
        winner_list,
        winners,
        price_exact_eur,
      } = document;

      if (!id || !id._text) {
        console.log('No ID found, skipping...', JSON.stringify(document));
        return resolve(true);
      }

      if (!type || !type._text) {
        console.log('No type found, skipping...', JSON.stringify(document));
        return resolve(true);
      }

      // skip the document if it's type is not allowed
      if (allowedTypes.indexOf(type._text) === -1) {
        // console.log(`Type '${type._text}' is not allowed. Skipping...`);
        return resolve(true);
      }

      // try to extract the winner as for different types it is located in different places
      if (winner_list) {
        if (Array.isArray(winner_list)) {
          winner_list.forEach(({ winner_name, winner_reg_num }) => {
            parsedWinners.push({
              winner_name: winner_name._text,
              winner_reg_num: winner_reg_num._text });
          });
        } else if (winner_list.winner) {
          parsedWinners.push({
            winner_name: winner_list.winner.winner_name._text,
            winner_reg_num: winner_list.winner.winner_reg_num._text,
          });
        } else {
          console.error('winner_list defined but failed parsing it...', JSON.stringify(document));
        }
      } else if (winners) {
        if (Array.isArray(winners)) {
          winners.forEach(({ winner_name, winner_reg_num }) => {
            winners.push({
              winner_name: winner_name._text,
              winner_reg_num: winner_reg_num._text,
            });
          });
        } else if (winners.winner) {
          parsedWinners.push({
            winner_name: winners.winner.firm ? winners.winner.firm._text: null,
            winner_reg_num: winners.winner.reg_num ? winners.winner.reg_num._text: null,
          });
        } else {
          console.error('winners defined but failed parsing it...', id, winners);
        }
      } else if (part_5.winner_list) {
        if (Array.isArray(part_5.winner_list)) {
          part_5.winner_list.forEach(({ winner_name, winner_reg_num }) => {
            parsedWinners.push({
              winner_name: winner_name._text,
              winner_reg_num: winner_reg_num._text
            });
          });
        } else if (part_5.winner_list.winner) {
          parsedWinners.push({
            winner_name: part_5.winner_list.winner.winner_name ? part_5.winner_list.winner.winner_name._text : null,
            winner_reg_num: part_5.winner_list.winner.winner_reg_num ? part_5.winner_list.winner.winner_reg_num._text : null,
          });
        } else {
          // console.error('part_5.winner_list defined but failed parsing it...', id, part_5.winner_list);
          return resolve(true);
        }
      } else if (Array.isArray(part_5)) {
        // console.log(`${document.id._text} part 5 is an array, skipping for now...`);
        return resolve(true);
      } else {
        // console.error('no winner found', JSON.stringify(document));
        return resolve(true);
      }

      authority_name = authority_name || general.authority_name;
      authority_reg_num = authority_reg_num || general.authority_reg_num;
      parsedPrice = price || contract_price_exact || part_5.contract_price_exact || price_exact_eur || contract_price_exact_lvl || part_5.contract_price_exact_lvl || price_exact_lvl;
      decision_date = decision_date || part_5.decision_date;
      currency = currency || exact_currency || contract_currency || part_5.contract_currency;
      contract_price_from = contract_price_from || part_5.contract_price_from;
      contract_price_to = contract_price_to || part_5.contract_price_to;

      if (parsedWinners.length > 1) {
        console.log(document)
      }
      return IubEntry.findOneAndUpdate(
        { document_id: id._text },
        {
          document_id: id._text,
          authority_name: authority_name ? authority_name._text : null,
          authority_reg_num: authority_reg_num ? authority_reg_num._text: null,
          tender_num: part_5.tender_num && !isNaN(parseInt(part_5.tender_num._text, 10)) ? parseInt(part_5.tender_num._text, 10) : null,
          decision_date: decision_date ? decision_date._text: null,
          price: parsedPrice && !isNaN(parseInt(parsedPrice._text, 10)) ? parseInt(parsedPrice._text, 10) : null,
          price_from: contract_price_from && !isNaN(parseInt(contract_price_from._text, 10)) ? parseInt(contract_price_from._text, 10): null,
          price_to: contract_price_to && !isNaN(parseInt(contract_price_to._text, 10)) ? parseInt(contract_price_to._text, 10): null,
          currency: currency && !isNaN(parseInt(currency._text, 10)) ? parseInt(currency._text, 10): null,
          eu_fund: eu_fund && !isNaN(parseInt(eu_fund._text, 10)) ? !!parseInt(eu_fund._text, 10) : false,
          winners: parsedWinners,
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

/**
 * Calls the next iteration if today has not been reached yet.
 *
 * @param {*} ftpClient
 * @param {string} year
 * @param {string} month
 * @param {string} day
 * @returns {*}
 */
function callNextIteration(ftpClient, year, month, day) {
  const fetchedDate = new Date();

  fetchedDate.setFullYear(parseInt(year));
  fetchedDate.setMonth(parseInt(month) - 1);
  fetchedDate.setDate(parseInt(day));

  if (helpers.isToday(fetchedDate)) {
    // Close FTP connection

    return ftpClient.end();
  } else {
    const nextDay = new Date();

    nextDay.setFullYear(parseInt(year, 10));
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
 * Fetches data from IUB.
 *
 * @public
 * @param {Object} req Request object
 * @param {Object} res Response object
 * @param {Function} next Executes the next matching route
 */
function fetchData(req, res, next) {
  const { year, month, day } = req.query;
  const parsedYear = parseInt(year, 10);
  const parsedMonth = monthStrings[month];
  const today = new Date();
  const todayYear = today.getFullYear();

  if (parsedYear < IUB.minYear) {
    return res.status(httpStatusCodes.badRequest).json(`Min year is ${IUB.minYear}. ${year} is invalid.`);
  }

  if (parsedYear > todayYear) {
    return res.status(httpStatusCodes.badRequest).json(`Max year is ${todayYear}. ${year} is invalid.`);
  }

  if (!parsedMonth) {
    return res.status(httpStatusCodes.badRequest).json(`Month ${month} is invalid. Pass one of the following: ${Object.keys(monthStrings).sort()}`);
  }

  if (dayStrings.indexOf(day) === -1) {
    return res.status(httpStatusCodes.badRequest).json(`Day ${day} is invalid. Pass one of the following: ${dayStrings}`);
  }

  fetchIUBData(year, month, day);

  res.status(httpStatusCodes.ok).json(`Data fetching for ${year}/${month}/${day} (YYYY/MM/DD) initiated successfully!`);
}


/**
 * Modules that are exported from the controller.
 */
module.exports = {
  /**
   * Fetches data from the IUB data.
   */
  fetchIUBData, fetchData
};
