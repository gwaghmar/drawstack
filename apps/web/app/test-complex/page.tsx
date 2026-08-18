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

export default function ComplexDashboard() {
  const [activeTab, setActiveTab] = useState("Telemetry");
  const [liveData, setLiveData] = useState(
    Array.from({ length: 15 }).map((_, i) => ({ time: i, alt: 400 + Math.random() * 50, vel: 28000 + Math.random() * 500 }))
  );
  const [cycle, setCycle] = useState(0);

  // Live updating chart data
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveData(prev => {
        const newData = [...prev.slice(1), { 
          time: prev[prev.length - 1].time + 1, 
          alt: 400 + Math.random() * 50, 
          vel: 28000 + Math.random() * 500 
        }];
        return newData;
      });
      setCycle(c => c + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const resourceData = [
    { name: "Liquid O2", value: 85 },
    { name: "Hydrazine", value: 42 },
    { name: "Xenon", value: 18 }
  ];

  const thermalData = [
    { sector: "Hull A", temp: 310 }, { sector: "Hull B", temp: 280 },
    { sector: "Engine", temp: 1200 }, { sector: "Solar Array", temp: -150 }
  ];

  const crewLog = [
    ["14:02:44", "CDR", "Manual Attitude Adjustment", <Badge variant="warning">OVRD</Badge>],
    ["13:50:11", "SYS", "Solar Array Deployment", <Badge variant="success">OK</Badge>],
    ["11:14:05", "ENG", "Thruster B Pressure Drop", <Badge variant="danger">WARN</Badge>],
    ["10:00:00", "SYS", "Daily Sync Completed", <Badge variant="neutral">INFO</Badge>],
  ];

  return (
    <div className="min-h-screen bg-black p-8 flex items-center justify-center">
      <ThemeProvider theme="retro">
        <Card className="w-full max-w-[1400px] h-[850px] flex flex-col gap-4 border-2 border-cyan-600 shadow-[0_0_30px_rgba(0,255,255,0.15)] bg-black overflow-hidden relative">
          
          {/* Header */}
          <div className="flex justify-between items-center border-b border-cyan-800 pb-4 shrink-0">
            <div className="flex items-center gap-4">
              <Icon name="Satellite" size={40} className="stroke-cyan-400 animate-pulse" />
              <div>
                <Typography variant="h1" className="!mb-0 text-cyan-400">ORBITAL COMMAND // ARES-V</Typography>
                <div className="flex gap-4 mt-2">
                  <Typography variant="caption" className="text-cyan-600 font-mono">LAT: 45.12N LON: 12.44E</Typography>
                  <Typography variant="caption" className="text-cyan-600 font-mono">MISSION T+ 142:11:0{cycle % 10}</Typography>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="success" className="animate-pulse">UPLINK SECURE</Badge>
              <Button variant="outline" className="border-cyan-600 text-cyan-400">
                <Icon name="Activity" size={16} className="inline mr-2" /> RUN DIAGNOSTIC
              </Button>
            </div>
          </div>

          <Tabs 
            tabs={["Telemetry", "Resources", "Crew Logs"]} 
            activeTab={activeTab} 
            onChange={setActiveTab} 
            className="shrink-0"
          />

          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {activeTab === "Telemetry" && (
                <motion.div 
                  key="telemetry"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col gap-4"
                >
                  <div className="grid grid-cols-4 gap-4 shrink-0">
                    <Card className="bg-cyan-950/30 border-cyan-900 !p-4">
                      <Typography variant="caption">ORBITAL VELOCITY</Typography>
                      <Typography variant="h2" className="text-cyan-300">28,140 km/h</Typography>
                      <LineChart data={liveData} xKey="time" yKey="vel" height={60} />
                    </Card>
                    <Card className="bg-cyan-950/30 border-cyan-900 !p-4">
                      <Typography variant="caption">ALTITUDE</Typography>
                      <Typography variant="h2" className="text-cyan-300">410.5 km</Typography>
                      <LineChart data={liveData} xKey="time" yKey="alt" height={60} />
                    </Card>
                    <Card className="bg-cyan-950/30 border-cyan-900 !p-4">
                      <Typography variant="caption">CABIN PRESSURE</Typography>
                      <Typography variant="h2" className="text-cyan-300">14.6 psi</Typography>
                      <div className="mt-4 flex gap-1">
                        {Array.from({length: 20}).map((_, i) => (
                          <div key={i} className={`h-2 flex-1 ${i < 18 ? 'bg-cyan-500' : 'bg-cyan-900'}`}></div>
                        ))}
                      </div>
                    </Card>
                    <Card className="bg-red-950/30 border-red-900 !p-4">
                      <Typography variant="caption" className="text-red-500">RADIATION EXPOSURE</Typography>
                      <Typography variant="h2" className="text-red-400">1.2 mSv</Typography>
                      <Icon name="Radio" className="stroke-red-500 mt-2 animate-bounce" />
                    </Card>
                  </div>
                  
                  <Card className="flex-1 bg-black border-cyan-900 flex flex-col relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                    <Typography variant="h3" className="relative z-10">TRAJECTORY PLOT // REALTIME</Typography>
                    <div className="flex-1 relative z-10 pt-4">
                      <LineChart data={liveData} xKey="time" yKey="alt" height={350} />
                    </div>
                  </Card>
                </motion.div>
              )}

              {activeTab === "Resources" && (
                <motion.div 
                  key="resources"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute inset-0 grid grid-cols-2 gap-4"
                >
                  <Card className="bg-cyan-950/30 border-cyan-900 flex flex-col items-center justify-center">
                    <Typography variant="h3" className="w-full text-left mb-8">PROPELLANT RESERVES</Typography>
                    <div className="w-full max-w-[400px]">
                      <DonutChart data={resourceData} height={300} />
                    </div>
                  </Card>
                  <Card className="bg-cyan-950/30 border-cyan-900">
                    <Typography variant="h3" className="mb-8">THERMAL DISTRIBUTION (°C)</Typography>
                    <BarChart data={thermalData} xKey="sector" yKey="temp" height={300} />
                  </Card>
                </motion.div>
              )}

              {activeTab === "Crew Logs" && (
                <motion.div 
                  key="logs"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col gap-4"
                >
                  <div className="flex gap-4">
                    <Input placeholder="Search logs..." className="flex-1" />
                    <Button variant="primary">FILTER</Button>
                  </div>
                  <Card className="flex-1 overflow-auto bg-black border-cyan-900 p-0">
                    <DataTable columns={["TIME", "STATION", "EVENT_DESCRIPTION", "SYS_STATUS"]} data={crewLog} />
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </ThemeProvider>
    </div>
  );
}
