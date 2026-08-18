"use client";
import React, { useState, useEffect } from "react";
import { ThemeProvider } from "@/components/canvas-ui/ThemeProvider";
import { Card } from "@/components/canvas-ui/Card";
import { Button } from "@/components/canvas-ui/Button";
import { Badge } from "@/components/canvas-ui/Badge";
import { Typography } from "@/components/canvas-ui/Typography";
import { Icon } from "@/components/canvas-ui/Icon";
import { Input } from "@/components/canvas-ui/Input";
import { Tabs } from "@/components/canvas-ui/Tabs";
import { DataTable } from "@/components/canvas-ui/DataTable";
import { BarChart } from "@/components/canvas-ui/charts/BarChart";
import { LineChart } from "@/components/canvas-ui/charts/LineChart";
import { DonutChart } from "@/components/canvas-ui/charts/DonutChart";
import { motion, AnimatePresence } from "framer-motion";
import { LiveProvider, LiveEditor, LiveError, LivePreview } from "react-live";

function MarketingDashboard() {
  const [activeTab, setActiveTab] = useState("Campaigns");
  const clickData = [
    { day: "Mon", clicks: 120 }, { day: "Tue", clicks: 250 },
    { day: "Wed", clicks: 180 }, { day: "Thu", clicks: 390 },
    { day: "Fri", clicks: 420 }, { day: "Sat", clicks: 310 }
  ];
  const demoData = [
    { name: "Gen Z", value: 35 }, { name: "Millennials", value: 45 }, { name: "Boomers", value: 20 }
  ];

  return (
    <ThemeProvider theme="brutalist">
      <Card className="h-[600px] flex flex-col gap-6 !p-8 m-8 shadow-2xl overflow-hidden" id="dashboard-1">
        <div className="flex justify-between items-end">
          <div>
            <Badge variant="warning" className="mb-4">LIVE METRICS</Badge>
            <Typography variant="h1" className="!mb-0">HYPE.FUNNEL</Typography>
          </div>
          <Button variant="primary" className="!px-8 !py-4 text-xl">
            DEPLOY ADS <Icon name="Rocket" className="inline ml-2" />
          </Button>
        </div>
        <Tabs tabs={["Campaigns", "Audiences", "Spend"]} activeTab={activeTab} onChange={setActiveTab} />
        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2 bg-[#FFEB3B]">
            <Typography variant="h3">CLICK VELOCITY</Typography>
            <BarChart data={clickData} xKey="day" yKey="clicks" height={200} />
          </Card>
          <Card className="bg-[#00FF00] flex flex-col items-center justify-center">
            <Typography variant="h3" className="w-full text-center">DEMOGRAPHICS</Typography>
            <DonutChart data={demoData} height={180} />
          </Card>
        </div>
      </Card>
    </ThemeProvider>
  );
}

function FinancialReport() {
  const revenueData = [
    { q: "Q1", rev: 4.2 }, { q: "Q2", rev: 4.8 }, 
    { q: "Q3", rev: 5.1 }, { q: "Q4", rev: 6.4 }
  ];

  return (
    <ThemeProvider theme="editorial">
      <Card className="h-[600px] !p-12 flex flex-col m-8 shadow-2xl overflow-hidden" id="dashboard-2">
        <div className="border-b-4 border-black pb-6 mb-8 flex justify-between items-start">
          <div className="w-2/3">
            <Typography variant="h4">ANNUAL SHAREHOLDER REPORT</Typography>
            <Typography variant="h1" className="text-7xl !tracking-tighter">FY2026 Earnings</Typography>
          </div>
          <div className="text-right">
            <Typography variant="h1" className="!mb-0 text-5xl">$20.5B</Typography>
            <Typography variant="body" className="font-bold">+18.4% YoY</Typography>
          </div>
        </div>
        <div className="flex gap-12 flex-1">
          <div className="w-1/2 flex flex-col justify-between">
            <Typography variant="body" className="text-xl leading-relaxed">
              The fourth quarter concluded with record-breaking margins across the enterprise software division.
              Strategic acquisitions in the AI sector have successfully integrated.
            </Typography>
            <div className="mt-8">
              <Typography variant="h4">REVENUE TRAJECTORY (BILLIONS)</Typography>
              <div className="h-[200px] w-full mt-4">
                <LineChart data={revenueData} xKey="q" yKey="rev" height={200} />
              </div>
            </div>
          </div>
          <div className="w-1/2">
            <Typography variant="h4" className="mb-4">DIVISIONAL BREAKDOWN</Typography>
            <DataTable 
              columns={["DIVISION", "Q4 REVENUE", "MARGIN", "GROWTH"]} 
              data={[
                ["Enterprise Cloud", "$2.4B", "84%", "+22%"],
                ["Consumer Hardware", "$1.8B", "32%", "-4%"],
                ["AI Infrastructure", "$1.2B", "68%", "+145%"]
              ]} 
            />
            <Button variant="outline" className="w-full mt-8 !py-4 border-2">Download Full PDF</Button>
          </div>
        </div>
      </Card>
    </ThemeProvider>
  );
}

function ThreatRadar() {
  const trafficData = Array.from({length: 10}).map((_, i) => ({
    time: "00:0" + i,
    packets: Math.floor(Math.random() * 1000) + 500
  }));

  return (
    <ThemeProvider theme="retro">
      <Card className="h-[600px] flex flex-col gap-4 border-2 border-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.2)] m-8 overflow-hidden bg-black" id="dashboard-3">
        <div className="flex justify-between items-center border-b border-cyan-800 pb-2">
          <div className="flex items-center gap-2">
            <Icon name="ShieldAlert" size={24} className="stroke-red-500" />
            <Typography variant="h2" className="!mb-0 text-red-500">DEFCON 2 // INTRUSION DETECTED</Typography>
          </div>
          <Badge variant="warning">ANALYSIS COMPLETE</Badge>
        </div>
        <div className="grid grid-cols-4 gap-4 flex-1">
          <div className="col-span-1 border-r border-cyan-900 pr-4 space-y-4">
            <Typography variant="h4">SYSTEM NODES</Typography>
            {["PROXY-ALPHA", "DB-CLUSTER-01", "AUTH-GATEWAY"].map(node => (
              <div key={node} className="flex justify-between items-center text-xs font-mono text-cyan-600 border border-cyan-900 p-2">
                {node}
                <Icon name="Terminal" size={14} />
              </div>
            ))}
            <Button variant="primary" className="w-full bg-red-900 text-red-100 border-red-500">
              INITIATE LOCKDOWN
            </Button>
          </div>
          <div className="col-span-3 flex flex-col gap-4">
            <div className="flex-1 bg-cyan-950/20 border border-cyan-900 p-4">
              <Typography variant="h4">INBOUND TRAFFIC ANOMALIES</Typography>
              <LineChart data={trafficData} xKey="time" yKey="packets" height={150} />
            </div>
            <DataTable 
              columns={["TIMESTAMP", "IP_ADDRESS", "VECTOR", "ACTION"]} 
              data={[
                ["04:22:10", "192.168.1.104", "SQL_INJECTION", <Badge variant="danger">BLOCKED</Badge>],
                ["04:22:08", "10.0.0.5", "DDOS_ATTEMPT", <Badge variant="warning">THROTTLED</Badge>]
              ]} 
            />
          </div>
        </div>
      </Card>
    </ThemeProvider>
  );
}

function AgentPanel() {
  const tokenData = [
    { name: "Input", value: 124000 },
    { name: "Output", value: 45000 },
    { name: "Tool", value: 12000 }
  ];

  return (
    <ThemeProvider theme="glass">
      <div className="p-8 h-[600px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 m-8 overflow-hidden relative" id="dashboard-4">
         {/* Background blur container wrapper so background is captured */}
         <div className="absolute inset-0 bg-slate-100 -z-10"></div>
        <Card className="h-full flex flex-col bg-white/40 border-white/60">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/30">
                <Icon name="BrainCircuit" size={28} />
              </div>
              <div>
                <Typography variant="h2" className="!mb-0">Antigravity Core</Typography>
                <Typography variant="caption">Model: claude-3.5-sonnet • Status: Active</Typography>
              </div>
            </div>
            <Button variant="primary" className="!rounded-xl shadow-indigo-500/20 shadow-lg">
              <Icon name="Settings" size={18} className="mr-2 inline" /> Configure
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-8 flex-1">
            <div className="space-y-6">
              <Card className="bg-white/60 !shadow-none !border-white/80">
                <Typography variant="h3">System Prompt</Typography>
                <Input defaultValue="You are an expert software engineer..." className="w-full bg-white/50 mb-4" />
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Temp: 0.7</span>
                </div>
              </Card>
              <Card className="bg-white/60 !shadow-none !border-white/80">
                <Typography variant="h3">Memory Context</Typography>
                <div className="flex gap-2 mb-4">
                  <Badge variant="neutral">Documentation</Badge>
                  <Badge variant="neutral">User Config</Badge>
                </div>
              </Card>
            </div>
            <div className="flex flex-col">
              <Card className="bg-white/60 !shadow-none !border-white/80 flex-1 flex flex-col items-center justify-center">
                <Typography variant="h3" className="w-full text-left">Resource Usage</Typography>
                <DonutChart data={tokenData} height={200} />
              </Card>
            </div>
          </div>
        </Card>
      </div>
    </ThemeProvider>
  );
}

function PatientRecord() {
  const heartRate = [
    { time: "08:00", hr: 72 }, { time: "12:00", hr: 84 },
    { time: "16:00", hr: 78 }, { time: "20:00", hr: 68 }
  ];

  return (
    <ThemeProvider theme="wireframe">
      <Card className="h-[600px] flex flex-col !rounded-sm !border-slate-400 m-8 overflow-hidden shadow-2xl" id="dashboard-5">
        <div className="border-b border-slate-300 pb-4 mb-4 flex justify-between">
          <div className="flex gap-6 items-center">
            <Icon name="UserCircle" size={48} className="stroke-slate-400" />
            <div>
              <Typography variant="h1" className="!mb-0 text-3xl">Doe, Jane A.</Typography>
              <Typography variant="body" className="!mb-0">ID: 884-992-11 | DOB: 1982-04-12 | Female</Typography>
            </div>
          </div>
          <Badge variant="warning">ATTENTION REQUIRED</Badge>
        </div>
        <Tabs tabs={["Clinical Summary", "Vitals & Labs", "Medications"]} activeTab="Vitals & Labs" />
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div className="border border-slate-300 rounded p-4">
            <div className="flex justify-between items-center mb-4">
              <Typography variant="h3">Heart Rate (24h)</Typography>
              <Icon name="HeartPulse" className="stroke-rose-500" />
            </div>
            <LineChart data={heartRate} xKey="time" yKey="hr" height={150} />
          </div>
          <div className="border border-slate-300 rounded p-4">
            <Typography variant="h3" className="mb-4">Recent Lab Results</Typography>
            <DataTable 
              columns={["TEST", "RESULT", "FLAG"]} 
              data={[
                ["Hemoglobin", "11.2 g/dL", <Badge variant="danger">LOW</Badge>],
                ["WBC Count", "7.4 K/uL", <Badge variant="success">NORMAL</Badge>]
              ]} 
            />
          </div>
        </div>
      </Card>
    </ThemeProvider>
  );
}

function ErrorHandlingTest() {
  const brokenCode = `
export default function BrokenApp() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    setData({ value: 100 }
  }, []);

  return (
    <ThemeProvider theme="retro">
      <Card>
        <Typography variant="h2">This will fail gracefully</Typography>
        <NonExistentComponent />
      </Card>
    </ThemeProvider>
  );
}
`;

  return (
    <ThemeProvider theme="brutalist">
      <Card className="h-[300px] flex flex-col !p-8 m-8 shadow-2xl overflow-hidden border-red-500" id="dashboard-6">
        <Typography variant="h3" className="text-red-500 mb-4">ENGINE ERROR BOUNDARY TEST</Typography>
        <Typography variant="body" className="mb-4">The AI generated broken code below. The system catches it and prevents the whole canvas from crashing.</Typography>
        
        <div className="flex-1 bg-black text-red-500 p-4 font-mono overflow-auto rounded">
          <LiveProvider 
            code={brokenCode}
            scope={{ React, ThemeProvider, Card, Typography, useState: React.useState, useEffect: React.useEffect }}
          >
            <LiveError />
            <div className="hidden"><LivePreview /></div>
          </LiveProvider>
        </div>
      </Card>
    </ThemeProvider>
  );
}

export default function EngineTestPage() {
  return (
    <div className="bg-slate-100 min-h-screen py-8 overflow-y-auto">
      <MarketingDashboard />
      <FinancialReport />
      <ThreatRadar />
      <AgentPanel />
      <PatientRecord />
      <ErrorHandlingTest />
    </div>
  );
}
