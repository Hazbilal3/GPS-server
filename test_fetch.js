async function run() {
  const res = await fetch('http://localhost:3010/uploads/payroll/daily');
  const data = await res.json();
  const testDriver = data.filter(d => d.driverId === 12345);
  console.log("DRIVER TEST DATA:");
  console.log(JSON.stringify(testDriver, null, 2));
}
run();
