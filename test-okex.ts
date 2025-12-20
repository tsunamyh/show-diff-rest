import axios from 'axios';

async function testOkexAPI() {
  try {
    console.log('Testing ok-ex.io API with USDT-IRT...');
    const response = await axios.get('https://sapi.ok-ex.io/api/v1/spot/public/books', {
      params: { symbol: 'USDT-IRT' ,limit : 5},
      timeout: 5000
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error:', error.message);
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
    } else {
      console.error('Error:', error);
    }
  }
}

testOkexAPI();
