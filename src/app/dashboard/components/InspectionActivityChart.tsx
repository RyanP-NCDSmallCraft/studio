"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Award, Activity } from "lucide-react";
import { format, subDays, startOfDay, isAfter } from "date-fns";

export function InspectionActivityChart() {
  const [data, setData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [topInspector, setTopInspector] = useState<{ name: string; count: number } | null>(null);
  const [totalPeriodInspections, setTotalPeriodInspections] = useState(0);

  useEffect(() => {
    async function fetchActivity() {
      try {
        setLoading(true);
        const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
        
        // Use scheduledDate to avoid missing index if we change fields in production
        // It's the most reliable date field according to our types
        const inspsRef = collection(db, "inspections");
        const q = query(
          inspsRef, 
          where("scheduledDate", ">=", Timestamp.fromDate(thirtyDaysAgo))
        );
        
        const snapshot = await getDocs(q);
        
        const countsByDate: Record<string, number> = {};
        const countsByInspector: Record<string, number> = {};
        
        let total = 0;

        // Initialize last 30 days with 0 so the chart looks complete
        for (let i = 29; i >= 0; i--) {
          const dateStr = format(subDays(new Date(), i), 'MMM dd');
          countsByDate[dateStr] = 0;
        }

        snapshot.forEach((doc) => {
          const data = doc.data();
          const dateVal = data.inspectionDate || data.scheduledDate;
          
          if (!dateVal) return;
          
          let dateObj: Date;
          if (dateVal instanceof Timestamp) {
            dateObj = dateVal.toDate();
          } else if (typeof dateVal === 'string') {
            dateObj = new Date(dateVal);
          } else {
             return; // Unknown format
          }

          // Only include if it actually falls within the 30 days (double check due to potential index quirks)
          if (isAfter(dateObj, thirtyDaysAgo) || dateObj.getTime() === thirtyDaysAgo.getTime()) {
             const dateStr = format(dateObj, 'MMM dd');
             if (countsByDate[dateStr] !== undefined) {
               countsByDate[dateStr]++;
             } else {
               countsByDate[dateStr] = 1;
             }
             
             total++;

             const inspectorName = data.inspectorData?.displayName || "Unassigned/Unknown";
             countsByInspector[inspectorName] = (countsByInspector[inspectorName] || 0) + 1;
          }
        });

        const chartData = Object.entries(countsByDate).map(([date, count]) => ({
          date,
          count
        }));

        setData(chartData);
        setTotalPeriodInspections(total);

        // Find top inspector
        let topName = "N/A";
        let topCount = 0;
        for (const [name, count] of Object.entries(countsByInspector)) {
          if (name !== "Unassigned/Unknown" && count > topCount) {
            topCount = count;
            topName = name;
          }
        }
        
        if (topCount > 0) {
           setTopInspector({ name: topName, count: topCount });
        }

      } catch (error) {
        console.error("Error fetching inspection activity:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, []);

  return (
    <div className="grid gap-6 md:grid-cols-4 mt-8 mb-4">
       {/* High Level KPI */}
       <Card className="md:col-span-1 bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border-indigo-500/20 relative overflow-hidden group">
          <div className="absolute -top-4 -right-4 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300 pointer-events-none">
             <Award className="w-32 h-32 text-indigo-500" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Most Active Inspector</CardTitle>
            <CardDescription className="text-indigo-600/70 font-medium">Last 30 Days</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            ) : topInspector ? (
              <>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-500 mb-2 truncate" title={topInspector.name}>
                  {topInspector.name}
                </div>
                <div className="text-sm font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 inline-flex items-center px-2.5 py-1 rounded-full shadow-sm">
                  <Activity className="w-4 h-4 mr-1" />
                  {topInspector.count} Inspections
                </div>
              </>
            ) : (
               <div className="text-xl font-bold text-indigo-600/50 mt-4">No data yet</div>
            )}
          </CardContent>
       </Card>

       {/* Chart */}
       <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Inspections Volume</CardTitle>
            <CardDescription>Daily inspection activity over the last 30 days ({totalPeriodInspections} total)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : data.length > 0 ? (
              <div className="h-[250px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.2} />
                    <XAxis 
                       dataKey="date" 
                       axisLine={false}
                       tickLine={false}
                       tick={{ fontSize: 12, fill: '#888888' }}
                       dy={10}
                       minTickGap={20}
                    />
                    <YAxis 
                       allowDecimals={false}
                       axisLine={false}
                       tickLine={false}
                       tick={{ fontSize: 12, fill: '#888888' }}
                    />
                    <Tooltip 
                       cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       labelStyle={{ fontWeight: 'bold', color: '#3730A3', marginBottom: '4px' }}
                    />
                    <Bar 
                       dataKey="count" 
                       name="Inspections" 
                       fill="#6366f1" 
                       radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
                <p className="text-muted-foreground font-medium">No inspections found in this timeframe</p>
              </div>
            )}
          </CardContent>
       </Card>
    </div>
  );
}
