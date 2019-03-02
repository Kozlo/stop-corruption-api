/**
 * IUB Data Fetcher controller.
 */
const ftpClientInstance = require('ftp');
const fs = require('fs');
const fse = require('fs-extra');
const targz = require('targz');
const xmlParser = require('xml-js');
const IubEntry = require('../models/iubEntry');
const fetch = require('../models/fetch');

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
      let parsedData;

      try {
        parsedData = JSON.parse(xmlParser.xml2json(data, { compact: true, spaces: 4 }));
      } catch (e) {
        console.error(e);
        return resolve(true);
      }

      const {
        id, // PVS dokumenta ID
        authority_name, // Iestādes nosaukums
        authority_reg_num = {}, // Iestādes reģistrācijas Nr.
        general: { // Vispārējie paziņojuma parametri
          main_cpv = {}, // Datu bloks satur iepirkuma galveno CPV kodu
        } = {},
        part_5_list: { // Līguma slēgšanas tiesību piešķiršana
          part_5: { // Saraksts var saturēt vienu vai vairākas paziņojuma par iepirkuma procedūras rezultātiem V daļas (paziņojuma par līguma slēgšanas tiesību piešķiršanu IV daļas) datu struktūras „part_5
            decision_date = {}, // Lēmuma pieņemšanas datums / Līguma slēgšanas datums
            contract_price_exact = {}, // Kopējā līgumcena
            exact_currency = {}, // Kopējā līgumcena – valūta.
            tender_num = {}, // Saņemto piedāvājumu skaits.
          } = {},
        } = {},
        eu_fund,
      } = parsedData.document;

      IubEntry.findOneAndUpdate(
        { document_id: id._text },
        {
          document_id: id._text,
          authority_name: authority_name ? authority_name._text : undefined,
          authority_reg_num: authority_reg_num._text,
          main_cpv: {
            lv: main_cpv.lv,
            en: main_cpv.en,
          },
          part_5_list: {
            part_5: {
              decision_date: decision_date._text,
              contract_price_exact: contract_price_exact._text,
              exact_currency: exact_currency._text,
              tender_num: tender_num._text,
            },
          },
          eu_fund: eu_fund === '0' ? false : eu_fund === '1' ? true : undefined,
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
 */
function extractIUBFileData(filePath, ftpClient, year, month, day) {
  // Remove directory and extension for file name, so we can save it in a specific directory
  const fileName = filePath.replace(`${IUB.IUBLocalDataDirectory}/`, '').replace('.tar.gz', '');

  console.log('extracting data...', filePath, fileName);

  // Decompress IUB .tar.gz files to our server
  targz.decompress({
    src: filePath,
    dest: `${IUB.IUBLocalDataDirectory}/${fileName}`
  }, err => {
    if (err) throw err;
console.log('data extracted... decompressing...')
    // If there are no errors, we have successfully decompressed the files
    // First let's delete the .tar.gz file
    fs.unlinkSync(filePath);

    // Now let's read files in the extracted directory
    fs.readdir(`${IUB.IUBLocalDataDirectory}/${fileName}`, (err, files) => {
      if (err) throw err;
console.log('directory read: ', `${IUB.IUBLocalDataDirectory}/${fileName}`)
      // Create promise array for the file parsing
      const IUBFileParsingPromises = [];

      // Go through each of the files
      files.forEach(file => {
        // Add each file to promise
        IUBFileParsingPromises.push(parseIUBXmlToJson(`${IUB.IUBLocalDataDirectory}/${fileName}/${file}`));
      });

      // Wait for all files are parsed
      return Promise.all(IUBFileParsingPromises).then(() => {
        // After all files are parsed, make sure that we delete directory with files
        fse.remove(`${IUB.IUBLocalDataDirectory}/${fileName}`, err => {
          if (err) throw err;
          console.log('directory and files deleted...');
          callNextIteration(ftpClient, year, month, day);
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
  const fetchedDateMonth = fetchedDate.getMonth() + 1;
  const fetchedDateDate = fetchedDate.getDate();
  const parsedDate = fetchedDateDate < 10 ? `0${fetchedDateDate}` : fetchedDateDate.toString();
  const parsedMonth = fetchedDateMonth < 10 ? `0${fetchedDateMonth}` : fetchedDateMonth.toString();
  const fetchedDateYear = fetchedDate.getFullYear();

  // const today = new Date();
  // const todayYear = today.getFullYear();
  // const todayMonth = today.getMonth();
  // const todayDate = today.getDate();
  if (2018 === fetchedDateYear && fetchedDateMonth === 11 && fetchedDateDate === 31) {
    // Close FTP connection
    console.log('toady reached, ending FTP...')
    return ftpClient.end();
  } else {
    const nextDay = new Date();
    nextDay.setFullYear(year);
    nextDay.setMonth(parseInt(month) - 1);
    nextDay.setDate(fetchedDateDate + 1);

    console.log(nextDay);
    const nextDayMonth = nextDay.getMonth() + 1;
    const nextDayDate = nextDay.getDate();
    const nextDayParsedDate = nextDayDate < 10 ? `0${nextDayDate}` : nextDayDate.toString();
    const nextDayParsedMonth = nextDayMonth < 10 ? `0${nextDayMonth}` : nextDayMonth.toString();
    const nextDayYear = nextDay.getFullYear().toString();

    console.log('fetching nextDay', nextDayYear, nextDayMonth, nextDayDate);
    console.log('fetching nextDay (parsed)', nextDayYear, nextDayParsedMonth, nextDayParsedDate);
    ftpClient.end();
    return fetchIUBData(nextDayYear, nextDayParsedMonth, nextDayParsedDate);
  }
}
/**
 * Downloads a specific file from the IUB Database.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server.
 * @param {Object} fileToFetch - Object of the current file that needs to be fetched.
 */
function downloadIUBData(ftpClient, fileToFetch, year, month, day) {
  // Get file stream from IUB FTP server
  ftpClient.get(fileToFetch.name, (err, stream) => {
    if (err) throw err;
console.log('fetched:', fileToFetch.name)
    // When ZIP file is saved, make sure to extract and save data
    stream.once('close', () => {
      // Save last fetched file data in the database
      fetch.find()
        .then(IUBfetchData => {
          // Let's retrieve data that we are going to save
          const dateForFile = fileToFetch.name.replace('.tar.gz', '').split('_');

          // Check if we have fetched anything
          if (IUBfetchData.length === 0) {
            // We have not, let's insert a new entry
            fetch.create({
              year: dateForFile[2],
              month: dateForFile[1],
              day: dateForFile[0],
              fetchedAt: new Date().toISOString()
            })
            .then(() => {
              // Close FTP connection
              ftpClient.end();

              // Extract IUB File
              extractIUBFileData(`${IUB.IUBLocalDataDirectory}/${fileToFetch.name}`, ftpClient, year, month, day);
            })
            .catch(err => {
              if (err) throw err;
            });
          } else {
            // We have already inserted, let's update it
            fetch.findByIdAndUpdate(IUBfetchData[0]._id, {
              year: dateForFile[2],
              month: dateForFile[1],
              day: dateForFile[0],
              fetchedAt: new Date().toISOString()
            }, { 'new': true, runValidators: true })
            .then(() => {
              // Close FTP connection
              ftpClient.end();

              // Extract IUB File
              extractIUBFileData(`${IUB.IUBLocalDataDirectory}/${fileToFetch.name}`, ftpClient, year, month, day);
            })
            .catch(err => {
              if (err) throw err;
            });
          }
        })
        .catch(err => {
          if (err) throw err;
        });

    });

    // Save the file to local system
    stream.pipe(fs.createWriteStream(`${IUB.IUBLocalDataDirectory}/${fileToFetch.name}`));
  });
}

/**
 * Reads IUB FTP structure.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server.
 * @param {string} year string
 * @param {string} month string
 * @param {string} day string
 */
function readIUBFtpStructure(ftpClient, year, month, day) {
  console.log('readIUBFtpStructure', year, month, day)
  // List all initial files/directories of IUB FTP
  ftpClient.list((err, rootList) => {
    if (err) throw err;
console.log('ftp list success')
    // Retrieve current directory
    ftpClient.pwd((err, currentDir) => {
      if (err) throw err;

      // Find last fetched data
      fetch.find()
        .then(IUBfetchData => {
          // If there are fetched data, set information about next fetchable file
          // if (IUBfetchData.length > 0) {
          //   year = IUBfetchData[0].year;
          //   month = IUBfetchData[0].month;
          //   day = IUBfetchData[0].day;

            // Check if we 
            // const date = new Date()
            // date.setFullYear(parseInt(year, 10));
            // date.setTime(date.getTime() + 86400000); // 86400000 is one day
            //
            // year = date.getFullYear().toString();
            // month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : `${date.getMonth() + 1}`;
            // day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate().toString();

            // console.log('Getting entries...', `${year}/${month}/${day}`);
          // } else {
          //   console.log('Initiating new fetch', `${year}/${month}/${day}`);
          // }

          // Filter only year directories and exclude any files.
          // TODO: Later, when DB is hooked up, we can filter directories that have not yet been added to our db
          const fetchYearDirectory = rootList.filter(item => item.type === 'd' && item.name === year)[0];
    
          // Navigate inside the year directory
          ftpClient.cwd(`${currentDir}/${fetchYearDirectory.name}`, err => {
            if (err) throw err;

            console.log('listing files...');
            // List files in the year directory
            ftpClient.list((err, monthList) => {
              if (err) throw err;
    
              // Filter out only month directories and exclude any files
              // TODO: Later, when DB is hooked up, we can filter directories that have not yet been added to our db
              const fetchMonthDirectory = monthList.filter(item => item.type === 'd' && item.name == `${month}_${year}`)[0];

              console.log('fetchMonthDirectory...', fetchMonthDirectory);

              // Navigate inside the month directory
              ftpClient.cwd(`${currentDir}/${fetchYearDirectory.name}/${fetchMonthDirectory.name}`, err => {
                if (err) throw err;

                console.log('listing files in mont dir...', `${currentDir}/${fetchYearDirectory.name}/${fetchMonthDirectory.name}`);
                // List the files in month directory
                ftpClient.list((err, fileList) => {
                  if (err) throw err;
    
                  // Filter out only tar.gz files
                  // TODO: Later, when DB is hooked up, we can filter ZIP files that have not yet been added to our db
                  let fileToFetch = fileList.filter(item => item.name.indexOf('.tar.gz') !== -1 && item.name === `${day}_${month}_${year}.tar.gz`)[0];
    
                  if (fileToFetch) {
                    console.log('downloading data....')
                    // Download the file and extract the data
                    downloadIUBData(ftpClient, fileToFetch, year, month, day);
                  } else {
                    callNextIteration(ftpClient, year, month, day);

                    // Check if we have fetched anything
                    // if (IUBfetchData.length === 0) {
                      console.log('data not fetched');
                      // We have not, let's insert a new entry
                      fetch.create({
                        year: year,
                        month: month,
                        day: day,
                        fetchedAt: new Date().toISOString()
                      })
                      .then(() => {
                        // Close FTP connection
                        ftpClient.end();
                      })
                      .catch(err => {
                        if (err) throw err;
                      });
                    // } else {
                    //   console.log('we already have data');
                    //
                    //   // We have already inserted, let's update it
                    //   fetch.findByIdAndUpdate(IUBfetchData[0]._id, {
                    //     year: year,
                    //     month: month,
                    //     day: day,
                    //     fetchedAt: new Date().toISOString()
                    //   }, { 'new': true, runValidators: true })
                    //   .then(() => ftpClient.end())
                    //   .catch(err => {
                    //     if (err) throw err;
                    //   });
                    // }
                  }
                });
              });
            });
          });
        })
        .catch(err => {
          if (err) throw err;
        });
    });
  });
}

function fetchIUBData(year, month, day) {
  // Initialize ftp client
  const ftpClient = new ftpClientInstance();

  // Retrieve directory list
  ftpClient.on('ready', () => readIUBFtpStructure(ftpClient, year, month, day));

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
