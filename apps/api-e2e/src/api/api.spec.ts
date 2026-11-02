import axios from 'axios';

describe('GET /api/health', () => {
  it('reports the API and database are up', async () => {
    const res = await axios.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ status: 'ok' });
  });
});
