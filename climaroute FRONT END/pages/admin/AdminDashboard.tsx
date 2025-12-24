import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Layout';
import { Map, AlertTriangle, FileText, Users, Truck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiService } from '../../services/apiservice';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await apiService.getDashboardStats();
        console.log('[Dashboard] Received stats:', data);
        setStats(data);
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  if (!stats) return <div className="p-8 text-center text-red-500">System Offline</div>;

  // Log values for debugging
  console.log('[Dashboard] Rendering with:', {
    activeFleet: stats.activeFleet,
    activeAlerts: stats.activeAlerts,
    totalDrivers: stats.totalDrivers,
    totalUsers: stats.totalUsers,
    weeklyVolume: stats.weeklyVolume
  });

  // Filter out admins from bar chart - only show drivers
  const driverDeliveries = (stats.weeklyVolume || []).filter((item: any) => 
    !item.role || item.role.toLowerCase() !== 'admin'
  );

  // Stats boxes displaying numeric metrics
  const statsBoxes = [
    { label: 'Active Fleet', value: stats.activeFleet ?? 0, color: 'bg-blue-100 text-blue-600', icon: Truck, path: '/admin/fleet', desc: 'InProgress trips' },
    { label: 'Active Alerts', value: stats.activeAlerts ?? 0, color: 'bg-red-100 text-red-600', icon: AlertTriangle, path: '/admin/alerts', desc: 'SOS alerts' },
    { label: 'Total Drivers', value: stats.totalDrivers ?? 0, color: 'bg-purple-100 text-purple-600', icon: Users, path: '/admin/users', desc: 'Driver accounts' },
    { label: 'Total Users', value: stats.totalUsers ?? 0, color: 'bg-green-100 text-green-600', icon: Users, path: '/admin/users', desc: 'All accounts' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Admin Overview</h2>

      {/* STATS BOXES AT TOP */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsBoxes.map((box) => (
          <div key={box.label} onClick={() => box.path && navigate(box.path)} className="cursor-pointer">
            <Card className="flex flex-col items-center justify-center h-full hover:shadow-lg transition-all">
              <div className={`p-3 rounded-full mb-3 ${box.color}`}>
                <box.icon size={24} />
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase">{box.label}</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{box.value}</p>
              <p className="text-xs text-gray-400 mt-1">{box.desc}</p>
            </Card>
          </div>
        ))}
      </div>

      {/* Bar Chart - Deliveries by Driver (excludes admins) */}
      <Card title="Completed Deliveries by Driver" className="w-full">
        <div style={{ height: Math.max(280, (driverDeliveries.length || 1) * 45) }}>
          {driverDeliveries && driverDeliveries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverDeliveries} margin={{ top: 10, right: 30, left: 20, bottom: driverDeliveries.length > 5 ? 60 : 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="user" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12 }} 
                  interval={0}
                  angle={driverDeliveries.length > 5 ? -45 : 0}
                  textAnchor={driverDeliveries.length > 5 ? 'end' : 'middle'}
                />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} label={{ value: 'Completed Deliveries', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                <Tooltip 
                  cursor={{fill: '#f3f4f6'}} 
                  contentStyle={{borderRadius: '8px'}} 
                  formatter={(value: number) => [`${value} deliveries`, 'Completed']}
                  labelFormatter={(label) => `Driver: ${label}`}
                />
                <Bar 
                  dataKey="count" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]} 
                  barSize={Math.min(50, Math.max(25, 350 / (driverDeliveries.length || 1)))} 
                  name="Completed" 
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>No drivers in system yet</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}