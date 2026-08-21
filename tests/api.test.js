const request = require('supertest');
const app = require('../server');
const { pool } = require('../db');

// Mock db calls for testing
jest.mock('../db', () => ({
  pool: {
    query: jest.fn()
  },
  setupDB: jest.fn()
}));

// Mock fetch for Geo Providers
global.fetch = jest.fn();

describe('Widget API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should accept CORS preflight', async () => {
    const res = await request(app).options('/submissions');
    expect(res.headers['access-control-allow-origin']).toBe('*'); // Or matching origin
    expect(res.status).toBe(204);
  });

  it('should reject invalid payload (missing widget_id or data)', async () => {
    const res = await request(app).post('/submissions').send({ data: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('widget_id and data are required');
  });

  it('should reject oversized payload', async () => {
    const largeData = 'a'.repeat(20000); // More than 10kb limit
    const res = await request(app).post('/submissions').send({ widget_id: '123', data: largeData });
    expect(res.status).toBe(413); // Payload Too Large
  });

  it('should silently drop spam (honeypot filled)', async () => {
    const res = await request(app).post('/submissions').send({ widget_id: '123', data: {}, _honeypot: 'im_a_bot' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should fallback geo providers if first fails', async () => {
    // Provider A fails
    global.fetch.mockImplementationOnce(() => Promise.reject(new Error('Provider A down')));
    // Provider B succeeds
    global.fetch.mockImplementationOnce(() => Promise.resolve({
      json: () => Promise.resolve({ country_name: 'Canada', city: 'Toronto' })
    }));

    pool.query.mockResolvedValueOnce({ rows: [{ user_id: 1 }] }); // widget exists
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // insert success

    const res = await request(app).post('/submissions').send({ widget_id: '123', data: { email: 'test@test.com' } });
    
    expect(res.status).toBe(201);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    // Check if db was called with Canada
    expect(pool.query.mock.calls[1][1]).toContain('Canada');
  });

  it('should rate limit rapid submissions', async () => {
    pool.query.mockResolvedValue({ rows: [{ user_id: 1 }] }); // Mock db so valid requests pass
    global.fetch.mockResolvedValue({
        json: () => Promise.resolve({ status: 'success', country: 'US', city: 'NY' })
    });
    // Limit is 10
    for (let i = 0; i < 10; i++) {
        await request(app).post('/submissions').send({ widget_id: '123', data: { email: \`test\${i}@test.com\` } });
    }
    const res = await request(app).post('/submissions').send({ widget_id: '123', data: { email: 'rate@test.com' } });
    expect(res.status).toBe(429);
  });
});
