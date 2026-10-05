import http from 'k6/http';
import { check, sleep } from 'k6';

// -------------------------------------------------------------------------
//  Server Capability Testing Configuration
// -------------------------------------------------------------------------

export const options = {
    // 1. Load Test Scenario: Simulate steady state traffic
    scenarios: {
        healthy_load: {
            executor: 'constant-vus',
            vus: 10,
            duration: '30s',
        },
        // 2. Spike Test Scenario (Uncomment to test handling extreme spikes)
        // spike_test: {
        //     executor: 'ramping-arrival-rate',
        //     startRate: 1, timeUnit: '1s',
        //     preAllocatedVUs: 50, maxVUs: 100,
        //     stages: [
        //         { target: 10, duration: '10s' }, // Normal load
        //         { target: 100, duration: '10s' }, // Spike
        //         { target: 10, duration: '10s' }, // Scale down
        //     ],
        // }
    },
    // Set Failure Thresholds
    thresholds: {
        http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1000ms
        http_req_failed: ['rate<0.05'], // Allow up to 5% failure rate
    },
};

// -------------------------------------------------------------------------
//  Variables
// -------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'https://api.gymshood.com'; // Override with: k6 run -e BASE_URL=...

export function setup() {
    // Authenticate once before the load test starts to get the token
    const loginPayload = JSON.stringify({
        email: "krishnkantsaraswat830@gmail.com",
        password: "12345678"
    });
    
    const resLogin = http.post(`${BASE_URL}/auth/login`, loginPayload, {
        headers: { 'Content-Type': 'application/json' }
    });

    let token = '';
    if (resLogin.status === 200) {
        try {
            const body = resLogin.json();
            token = body.token || body.data?.token || ''; 
            console.log("Successfully logged in and retrieved token.");
        } catch(e) {
            console.error("Failed to parse login response:", e);
        }
    } else {
        console.error(`Login failed with status ${resLogin.status}`);
    }

    return { token: token }; // Pass data to default function
}

export default function (data) {
    const AUTH_TOKEN = __ENV.AUTH_TOKEN || data.token || 'YOUR_JWT_TOKEN_HERE';

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTH_TOKEN}`
        },
    };

    // ---------------------------------------------------------------------
    // API ENDPOINTS TO TEST
    // ---------------------------------------------------------------------

    // 1. Healthcheck / Utils
    let resPing = http.get(`${BASE_URL}/ping`);
    check(resPing, { 'Ping is 200': (r) => r.status === 200 });

    let resDebug = http.get(`${BASE_URL}/debug-files`);
    check(resDebug, { 'Debug is 200': (r) => r.status === 200 });

    // 2. Public Gym Data
    let resGyms = http.get(`${BASE_URL}/gymdb/gyms`);
    check(resGyms, { 'Gym list is successfully handled': (r) => r.status === 200 || r.status === 404 });

    // 3. User Authentication (Login load test using provided credentials)
    const loginPayload = JSON.stringify({
        email: "krishnkantsaraswat830@gmail.com",
        password: "12345678"
    });
    let resLogin = http.post(`${BASE_URL}/auth/login`, loginPayload, {
        headers: { 'Content-Type': 'application/json' }
    });
    check(resLogin, { 'Login endpoint handled request': (r) => r.status !== 500 }); // Expect 200 on success, 40x on validation fail. 500 = Server Exception.

    // 4. Authenticated Endpoints (Requires valid AUTH_TOKEN)
    // 4a. Get Profile
    let resProfile = http.get(`${BASE_URL}/auth/profile`, params);
    check(resProfile, { 'Auth profile handled': (r) => r.status !== 500 });
    
    // 4b. Admin Stats (Will fail with 403 Forbidden without Admin JWT)
    let resAdminStats = http.get(`${BASE_URL}/admin/stats`, params);
    check(resAdminStats, { 'Admin stats handled': (r) => r.status !== 500 });

    // 4c. Payment gym-balance 
    let resBalance = http.get(`${BASE_URL}/payment/gym-balance`, params);
    check(resBalance, { 'Payment balance handled': (r) => r.status !== 500 });

    // Delay between iterations to simulate real user behavior
    sleep(1);
}

// -------------------------------------------------------------------------
//  Reporting / Summary Generation
// -------------------------------------------------------------------------

import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

export function handleSummary(data) {
    console.log("Generating reports...");
    return {
        "report.html": htmlReport(data),
        "summary.json": JSON.stringify(data),
        stdout: textSummary(data, { indent: " ", enableColors: true }),
    };
}
