async function run() {
  const http = require('http');
  http.get('http://localhost:3010/uploads/payroll/daily', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log("RAW RESPONSE BEGIN");
      console.log(data);
      console.log("RAW RESPONSE END");
    });
  });
}
run();
