const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const complexDashboardCode = `
function Dashboard() {
  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans text-slate-800">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Q3 Performance Overview</h1>
          <p className="text-slate-500 mt-1">Real-time metrics for all active campaigns</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-medium hover:bg-slate-50 transition-colors">Export Report</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 transition-colors">New Campaign</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 z-0"></div>
          <div className="relative z-10">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Total Revenue</h3>
            <div className="text-4xl font-bold text-slate-900 mb-2">$124,500</div>
            <div className="flex items-center text-sm">
              <span className="text-emerald-500 font-medium flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">↑ 14.5%</span>
              <span className="text-slate-400 ml-2">vs last month</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 z-0"></div>
          <div className="relative z-10">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Active Users</h3>
            <div className="text-4xl font-bold text-slate-900 mb-2">45.2K</div>
            <div className="flex items-center text-sm">
              <span className="text-emerald-500 font-medium flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">↑ 8.2%</span>
              <span className="text-slate-400 ml-2">vs last month</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-full -mr-10 -mt-10 z-0"></div>
          <div className="relative z-10">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Churn Rate</h3>
            <div className="text-4xl font-bold text-slate-900 mb-2">1.2%</div>
            <div className="flex items-center text-sm">
              <span className="text-rose-500 font-medium flex items-center bg-rose-50 px-2 py-0.5 rounded-full">↓ 0.4%</span>
              <span className="text-slate-400 ml-2">vs last month</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Transactions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-sm font-medium text-slate-500">
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">A</div>
                    <span className="font-medium text-slate-700">Acme Corp</span>
                  </td>
                  <td className="py-4"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium border border-emerald-100">Completed</span></td>
                  <td className="py-4 text-slate-500">Today, 2:45 PM</td>
                  <td className="py-4 text-right font-medium text-slate-900">$4,500.00</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">G</div>
                    <span className="font-medium text-slate-700">Globex Inc</span>
                  </td>
                  <td className="py-4"><span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium border border-amber-100">Pending</span></td>
                  <td className="py-4 text-slate-500">Yesterday, 9:20 AM</td>
                  <td className="py-4 text-right font-medium text-slate-900">$1,250.00</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">I</div>
                    <span className="font-medium text-slate-700">Initech</span>
                  </td>
                  <td className="py-4"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium border border-emerald-100">Completed</span></td>
                  <td className="py-4 text-slate-500">Aug 15, 2026</td>
                  <td className="py-4 text-right font-medium text-slate-900">$8,900.50</td>
                </tr>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">M</div>
                    <span className="font-medium text-slate-700">Massive Dynamic</span>
                  </td>
                  <td className="py-4"><span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-medium border border-rose-100">Failed</span></td>
                  <td className="py-4 text-slate-500">Aug 14, 2026</td>
                  <td className="py-4 text-right font-medium text-slate-900">$345.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Traffic Sources</h3>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <span className="font-medium text-slate-700">Direct Search</span>
                <span className="text-slate-500">45%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <span className="font-medium text-slate-700">Social Media</span>
                <span className="text-slate-500">30%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '30%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <span className="font-medium text-slate-700">Referrals</span>
                <span className="text-slate-500">15%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '15%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <span className="font-medium text-slate-700">Email Campaigns</span>
                <span className="text-slate-500">10%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-rose-400 h-2 rounded-full" style={{ width: '10%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Render</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="root" style="width: 1000px; height: 800px;"></div>
  <script type="text/babel">
    ${complexDashboardCode}

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<Dashboard />);
  </script>
</body>
</html>
`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  
  // Wait a moment for rendering
  await page.waitForTimeout(1000);
  
  const targetDir = "/Users/redforman/.gemini/antigravity/brain/030f7889-3adf-4458-a2a1-300588d217fd";
  const outputPath = path.join(targetDir, "dashboard_preview.png");
  
  await page.screenshot({ path: outputPath });
  await browser.close();
  
  console.log("Screenshot saved to: " + outputPath);
})();
