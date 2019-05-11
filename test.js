const { execFile } = require('child_process');

execFile('python',
  ['./python/lursoft.py',
    'qweqwe',
    'qweqweeqwewqPass',
    JSON.stringify(["45403000253","42403037066","40003026637","40003026611"])
  ],
  (error, stdout, stderr) => {
    if (error) {
      return console.error(error);
    }

    if (stderr) {
      const errorMessage = "Child process error occurred!";

      return console.error(errorMessage, stdError);
    }

//    console.log(JSON.parse(stdout))
  }
);

// Takes stdout data from script which executed
// with arguments and send this data to res object
// process.stdout.on('data', (data) => {
//     console.log(data.toString());
// });
