async function test() {
  const payload = {
    firstName: 'Jonas',
    phoneNumber: '(860) 960-2369'
  };

  await fetch(`http://localhost:3010/airtable/edit-driver/15`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log('Reverted Jonas');
}
test();
