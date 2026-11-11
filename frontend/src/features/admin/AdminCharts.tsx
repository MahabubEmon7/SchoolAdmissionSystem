import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { pluralize } from '../../lib/format';
import type { AdminStats } from '../../lib/types';

interface AdminChartsProps {
  stats?: AdminStats;
}

const PIE_COLORS = {
  confirmed: '#10b981', // emerald-500
  held: '#f59e0b',      // amber-500
  available: '#38bdf8', // sky-400
  waitlist: '#f43f5e',  // rose-500
};

export function AdminCharts({ stats }: AdminChartsProps) {
  if (!stats || stats.classes.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-800 bg-slate-900/60 p-8 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-slate-300">No chart data yet</p>
          <p className="text-xs text-slate-500 mt-1">Create classes to visualize seat distributions and occupancy.</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900/60 p-8 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-slate-300">No class comparison yet</p>
          <p className="text-xs text-slate-500 mt-1">Add classes to compare capacity and waitlists side by side.</p>
        </Card>
      </div>
    );
  }

  // Data for Donut / Pie Chart
  const pieData = [
    { name: 'Confirmed', value: stats.totalConfirmed, color: PIE_COLORS.confirmed },
    { name: 'Held (Pending)', value: stats.totalHeld, color: PIE_COLORS.held },
    { name: 'Available', value: stats.totalAvailable, color: PIE_COLORS.available },
    { name: 'Waitlist', value: stats.totalWaitlist, color: PIE_COLORS.waitlist },
  ].filter((d) => d.value > 0);

  // If no seats are taken, show total available
  const displayPieData = pieData.length > 0 ? pieData : [
    { name: 'Available', value: stats.totalCapacity, color: PIE_COLORS.available }
  ];

  // Data for Class Comparison Bar Chart
  const barData = stats.classes.map((c) => ({
    name: c.name.replace(' - ', '\n').replace(' Shift', ''),
    fullName: c.name,
    Confirmed: c.confirmedSeats,
    Held: c.heldSeats,
    Available: c.availableSeats,
    Waitlist: c.waitlistCount,
    total: c.totalSeats,
    occupancy: c.occupancyRate,
  }));

  // Data for Shift comparison
  const shiftData = stats.shiftStats
    .filter((s) => s.totalSeats > 0 || s.waitlist > 0)
    .map((s) => ({
      name: s.label.replace(' Shift', ''),
      Confirmed: s.confirmed,
      Held: s.held,
      Available: s.available,
      Waitlist: s.waitlist,
      total: s.totalSeats,
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Donut Chart: Overall Seat Breakdown */}
        <Card className="lg:col-span-5 border-slate-800 bg-slate-900/60 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Overall Seat Distribution</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Proportion of confirmed, held, available, and queued seats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {displayPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} seats`, name]}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-slate-300 font-medium">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart: Class-by-Class Comparative Analysis */}
        <Card className="lg:col-span-7 border-slate-800 bg-slate-900/60 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Class-by-Class Seat Breakdown</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Comparing confirmed, held, available, and waitlist counts across every class
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any, item: any) => [
                      pluralize(Number(value) || 0, 'seat', 'seats'),
                      `${name} (${item.payload.fullName})`,
                    ]}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-slate-300 font-medium">{value}</span>
                    )}
                  />
                  <Bar dataKey="Confirmed" fill={PIE_COLORS.confirmed} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="Held" fill={PIE_COLORS.held} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="Available" fill={PIE_COLORS.available} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="Waitlist" fill={PIE_COLORS.waitlist} radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shift breakdown bar chart for Morning vs Day */}
      {shiftData.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/60 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Shift Demand Comparison</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Seat allocation and demand comparison across Morning and Day shifts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shiftData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-slate-300 font-medium">{value}</span>
                    )}
                  />
                  <Bar dataKey="Confirmed" fill={PIE_COLORS.confirmed} stackId="a" />
                  <Bar dataKey="Held" fill={PIE_COLORS.held} stackId="a" />
                  <Bar dataKey="Available" fill={PIE_COLORS.available} stackId="a" />
                  <Bar dataKey="Waitlist" fill={PIE_COLORS.waitlist} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

