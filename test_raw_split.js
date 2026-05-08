async function run() {
  const http = require('http');
  http.get('http://localhost:3010/uploads/payroll/daily', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      const parts = data.split('},{');
      for (const part of parts) {
        if (part.includes('12345')) {
          console.log("Found:", part);
        }
      }
    });
  });
}
run();
