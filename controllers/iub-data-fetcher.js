/**
 * IUB Data Fetcher controller.
 */
const ftpClientInstance = require('ftp');
const fs = require('fs');
const fse = require('fs-extra');
const targz = require('targz');
const xmlParser = require('xml2json');
const IubEntry = require('../models/iubEntry');

const config = require('../config');

/**
 * Include configuration and helpers
 */
const { httpStatusCodes, monthStrings, dayStrings, IUB } = config;
const helpers = require('../helpers');

// CONSTANTS
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
        document = JSON.parse(xmlParser.toJson(data)).document;
      } catch (e) {
        // console.error(e);
        return resolve(true);
      }

      saveData(document);

      resolve(true);
    });
  });
}

/**
 * Saves docuemnt data to the DB.
 *
 * @param {*} document
 */
function saveData(document) {
  let parsedPrice, parsedWinners;
  let {
    id, // PVS dokumenta ID
    type, // Dokumenta tips (paziņojums,lēmums utt.)
    authority_name, // Iestādes nosaukums
    authority_reg_num, // Iestādes reģistrācijas Nr.
    eu_fund, // vai iepirkums saistīts ar ES fondu piesaisti
    currency, exact_currency, contract_currency,
    decision_date,
    price, price_exact_lvl, price_exact_eur,
    contract_price_exact, contract_price_exact_lvl,
    contract_price_from, contract_price_to,
    general = {}, // { // Vispārējie paziņojuma parametri
    part_5_list: { // Līguma slēgšanas tiesību piešķiršana
      part_5 = {},
    } = {},
  } = document;

  if (!id) {
    console.log(id)
    console.log('No ID found, skipping...', JSON.stringify(document));
    return;
  }

  if (!type) {
    // console.log('No type found, skipping...', JSON.stringify(document));
    return;
  }

  // skip the document if it's type is not allowed
  if (allowedTypes.indexOf(type) === -1) {
    // console.log(`Type '${type}' is not allowed. Skipping...`);
    return;
  }

  parsedWinners = getWinnerList(document);

  // don't save the data if there are no winners
  if (!parsedWinners) {
    return;
  }

  // const winnerRegNumbers = parsedWinners.map(({ winner_reg_num }) => winner_reg_num);

  const uniqueWinners = {};

  // get unique winners from the winner list (there can several winners for the same item)
  parsedWinners.forEach(winner => {
    if (!uniqueWinners[winner.winner_reg_num]) {
      uniqueWinners[winner.winner_reg_num] = '';
    }
  });

  const winnerInfo = Object.keys(uniqueWinners).map(winnerRegNum => {
    return new Promise(resolve => {
      // console.log('getting person....', winnerRegNum);
      if (helpers.isValidLVRegNum(winnerRegNum)) {
        resolve(
            getPerson(winnerRegNum)
                .then(data => {
                  uniqueWinners[winnerRegNum] = data.registered || '';
                })
                .catch(console.error)
        );
      } else {
        resolve();
      }
    });
  });

  Promise.all(winnerInfo)
      .then(() => {
        // console.log('Unique winners:', uniqueWinners);
        // assign the found winner registration numbers to the parsed winner list
        parsedWinners.forEach(winner => {
          winner.winner_reg_date = uniqueWinners[winner.winner_reg_num];
        });
        // console.log('PARSED WINNERS', parsedWinners)
        authority_name = authority_name || general.authority_name;
        authority_reg_num = authority_reg_num || general.authority_reg_num;
        parsedPrice = price || contract_price_exact || part_5.contract_price_exact || price_exact_eur || contract_price_exact_lvl || part_5.contract_price_exact_lvl || price_exact_lvl;
        decision_date = decision_date || part_5.decision_date;
        currency = currency || exact_currency || contract_currency || part_5.contract_currency;
        contract_price_from = contract_price_from || part_5.contract_price_from;
        contract_price_to = contract_price_to || part_5.contract_price_to;

        const companyData = {
          document_id: id,
          authority_name: authority_name || null,
          authority_reg_num: authority_reg_num || null,
          tender_num: !isNaN(parseInt(part_5.tender_num, 10)) ? parseInt(part_5.tender_num, 10) : null,
          decision_date: decision_date || null,
          price: !isNaN(parseInt(parsedPrice, 10)) ? parseInt(parsedPrice, 10) : null,
          price_from: !isNaN(parseInt(contract_price_from, 10)) ? parseInt(contract_price_from, 10) : null,
          price_to: !isNaN(parseInt(contract_price_to, 10)) ? parseInt(contract_price_to, 10) : null,
          currency: !isNaN(parseInt(currency, 10)) ? parseInt(currency, 10) : null,
          eu_fund: !isNaN(parseInt(eu_fund, 10)) ? !!parseInt(eu_fund, 10) : false,
          winners: parsedWinners,
        };

        return IubEntry.findOneAndUpdate(
            { document_id: id },
            companyData,
            {
              upsert: true, // insert if not found
            }
        )
      })
      .catch(console.error);
}

/**
 * Gets winner list form the procurement.
 *
 * @param {*} document IUB procurement full data
 * @returns {*}
 */
function getWinnerList(document) {
  const {
    winner_list, winners,
    part_5_list: {
      part_5 = {},
    } = {},
  } = document;
  const parsedWinners = [];

  // try to extract the winner as for different types it is located in different places
  if (winner_list) {
    if (Array.isArray(winner_list)) {
      winner_list.forEach(({ winner_name, winner_reg_num }) => {
        parsedWinners.push({
          winner_name: typeof winner_name === 'string' ? winner_name : '',
          winner_reg_num: typeof winner_reg_num === 'string' ? winner_reg_num : '',
        });
      });
    } else if (winner_list.winner) {
      parsedWinners.push({
        winner_name:  typeof winner_list.winner.winner_name === 'string' ? winner_list.winner.winner_name : '',
        winner_reg_num:  typeof winner_list.winner.winner_reg_num === 'string' ? winner_list.winner.winner_reg_num : '',
      });
    } else if (JSON.stringify(winner_list) === JSON.stringify({})) {
      // console.log('winner_list is an empty object');
      return;
    } else {
      console.error('winner_list defined but failed parsing it...', JSON.stringify(document));
    }
  } else if (winners) {
    if (Array.isArray(winners)) {
      winners.forEach(({ winner_name, winner_reg_num }) => {
        winners.push({
          winner_name: typeof winner_name === 'string' ? winner_name : '',
          winner_reg_num: typeof winner_reg_num === 'string' ? winner_reg_num : '',
        });
      });
    } else if (winners.winner) {
      parsedWinners.push({
        winner_name: winners.winner.firm ? winners.winner.firm : null,
        winner_reg_num: typeof winners.winner.reg_num === 'string' ? winners.winner.reg_num : null,
      });
    } else if (JSON.stringify(winners) === JSON.stringify({})) {
      // console.log('winners is an empty object');
      return;
    } else {
      console.error('winners defined but failed parsing it...');
    }
  } else if (part_5.winner_list) {
    if (Array.isArray(part_5.winner_list)) {
      part_5.winner_list.forEach(({ winner_name, winner_reg_num }) => {
        parsedWinners.push({
          winner_name: typeof winner_name === 'string' ? winner_name : '',
          winner_reg_num: typeof winner_reg_num === 'string' ? winner_reg_num : '',
        });
      });
    } else if (part_5.winner_list.winner) {
      parsedWinners.push({
        winner_name: typeof part_5.winner_list.winner.winner_name === 'string' ? part_5.winner_list.winner.winner_name : null,
        winner_reg_num: typeof part_5.winner_list.winner.winner_reg_num === 'string' ? part_5.winner_list.winner.winner_reg_num : null,
      });
    } else if (JSON.stringify(part_5.winner_list) === JSON.stringify({})) {
      // console.log('winner_list is an empty object');
      return;
    } else {
      console.error('part_5.winner_list defined but failed parsing it...');
      return;
    }
  } else if (Array.isArray(part_5)) {
    console.log(`${document.id} part 5 is an array, splitting up`);

    let saveDataNextTimeout = 0; // how long should wait until the next iteration
    // split up
    part_5.forEach((part_5_item, index) => {
      const subProcurement = {
        ...document,
      };

      subProcurement.part_5_list.part_5 = part_5[index];
      // TODO: check if the promise is still necessary
      new Promise(resolve => {
          // console.log('saving sub procurement....', subProcurement.id);
          resolve(
              saveData(subProcurement)
          );
      });
    });

    return;
  } else {
    console.error('no winner found'); //JSON.stringify(document));
    return;
  }

  return parsedWinners;
}

/**
 * Extracts a specific .tar.gz file and saves the files to the database.
 *
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
        // TODO: check if the promise is still necessary
        IUBFileParsingPromises.push(
            new Promise(resolve => {
              // console.log('parsing xml....', `${fileDirectoryPath}/${file}`)
              resolve(
                  parseIUBXmlToJson(`${fileDirectoryPath}/${file}`)
              );
            })
        );
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
    const nextDayParsedDate = helpers.getParsedDateNumber(nextDayDate);
    const nextDayParsedMonth = helpers.getParsedDateNumber(nextDayMonth);
    const nextDayYear = nextDay.getFullYear().toString();

    ftpClient.end();

    return fetchIUBData(nextDayYear, nextDayParsedMonth, nextDayParsedDate);
  }
}

/**
 * Downloads a specific file from the IUB Database.
 *
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
 *
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
  const { year, month, day, passkey } = req.query;

  if (passkey !== process.env.PASSKEY) {
    return res.status(httpStatusCodes.forbidden)
  }

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

  fetchIUBData(year, month, day)
      .catch(console.error);

  res.status(httpStatusCodes.ok).json(`Data fetching for ${year}/${month}/${day} (YYYY/MM/DD) initiated successfully!`);
}

/**
 * Gets a person (copmany) from the UR Database.
 *
 * @param {string} regNr Company registration number
 * @returns {PromiseLike<Promise.response>}
 */
function getPerson(regNr) {
  // TODO: add UR request here
  return Promise.resolve({});
  // return helpers.soapRequest()
  //     .then(data => data['soap:Body'])
  //     .then((data) => data.answer.person);
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
